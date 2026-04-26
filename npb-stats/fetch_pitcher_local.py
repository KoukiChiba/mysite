"""
投手成績データを取得するスクリプト。
データソース: npb.jp

使い方:
    python3 fetch_pitcher_local.py 2024
    python3 fetch_pitcher_local.py 2023

引数を省略すると2024年のデータを取得する。
"""
import sys
import time
import os
import requests
from bs4 import BeautifulSoup
import pandas as pd

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TEAM_INFO = [
    ("読売ジャイアンツ",             "g"),
    ("阪神タイガース",               "t"),
    ("広島東洋カープ",               "c"),
    ("横浜DeNAベイスターズ",         "db"),
    ("東京ヤクルトスワローズ",       "s"),
    ("中日ドラゴンズ",               "d"),
    ("千葉ロッテマリーンズ",         "m"),
    ("福岡ソフトバンクホークス",     "h"),
    ("北海道日本ハムファイターズ",   "f"),
    ("東北楽天ゴールデンイーグルス", "e"),
    ("埼玉西武ライオンズ",           "l"),
    ("オリックス・バファローズ",     "b"),
]

COL_MAP = {
    "投手": "Name", "投\u3000手": "Name", "選手": "Name",
    "登板": "G", "勝利": "W", "敗北": "L",
    "セ｜ブ": "SV", "セーブ": "SV",
    "ホ｜ル": "HLD", "ホールド": "HLD",
    "ＨＰ": "HP", "完投": "CG", "完封勝": "SHO", "無四球": "NHB",
    "勝率": "WPCT", "打者": "BF", "投球回": "IP",
    "安打": "HA", "本塁打": "HRA",
    "四球": "BB", "故意四": "IBB", "死球": "HBP",
    "三振": "SO", "暴投": "WP",
    "ボ｜ク": "BK", "ボーク": "BK",
    "失点": "R", "自責点": "ER", "防御率": "ERA",
}

NUMERIC_COLS = ["G", "W", "L", "SV", "HLD", "HP", "CG", "SHO", "NHB",
                "BF", "HA", "HRA", "BB", "IBB", "HBP", "SO", "WP", "BK",
                "R", "ER", "ERA", "WPCT"]


def ip_to_decimal(s) -> float:
    """'12.1' → 12.333,  '69' → 69.0,  '+' → 0.0（0アウト退場の特殊表記）"""
    s = str(s).strip()
    if not s or s == "+":
        return 0.0
    if "." in s:
        w, f = s.split(".", 1)
        return (int(w) if w else 0) + (int(f) / 3 if f else 0)
    return float(s)


def fetch_team(year: int, team_ja: str, code: str) -> pd.DataFrame:
    url = f"https://npb.jp/bis/{year}/stats/idp1_{code}.html"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 404:
        r = requests.get(f"https://npb.jp/bis/{year}/stats/idp1_{code}s.html", headers=HEADERS, timeout=15)
    r.raise_for_status()

    soup = BeautifulSoup(r.content, "lxml")
    rows = soup.find_all("table")[0].find_all("tr")

    if rows[0].find("th"):
        # ── 新形式（2025〜）: row0=th ヘッダー, 利き手は名前に埋め込み ──
        col_names = [th.get_text(strip=True) for th in rows[0].find_all("th")]
        data = []
        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["th", "td"])]
            if len(cells) == len(col_names):
                data.append(cells)
        df = pd.DataFrame(data, columns=col_names)

        name_col = "選手"
        df["Hand"] = df[name_col].str.extract(r"^([*+])")[0].map({"*": "Left", "+": "Switch"}).fillna("Right")
        df[name_col] = df[name_col].str.lstrip("*+").str.strip()

    else:
        # ── 旧形式（〜2024）: row0=注記, row1=ヘッダー, row2〜=データ ──
        # 先頭列=利き手, 投球回の直後に端数イニング用の空列あり
        raw_cols = [td.get_text(strip=True) for td in rows[1].find_all(["th", "td"])]

        # 投球回の直後の空列インデックスを検出
        try:
            ip_pos = raw_cols.index("投球回")
            ip_has_frac = ip_pos + 1 < len(raw_cols) and raw_cols[ip_pos + 1] == ""
        except ValueError:
            ip_pos = None
            ip_has_frac = False

        # 使用する列名（hand列と端数列を除く）
        col_names = raw_cols[1:]  # hand列（先頭）を除く
        if ip_has_frac:
            frac_pos_in_col_names = ip_pos - 1 + 1  # hand除いた後のインデックス
            col_names = col_names[:frac_pos_in_col_names] + col_names[frac_pos_in_col_names + 1:]

        data = []
        hands = []
        for row in rows[2:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["th", "td"])]
            if len(cells) != len(raw_cols):
                continue
            hand_marker = cells[0]
            cells = cells[1:]  # hand列除去
            if ip_has_frac:
                # IP whole + fraction を結合
                whole = cells[ip_pos - 1]
                frac  = cells[ip_pos]      # 元のip_pos+1 が hand除去後はip_pos
                cells[ip_pos - 1] = whole + frac
                cells.pop(ip_pos)
            data.append(cells)
            hands.append(hand_marker)

        df = pd.DataFrame(data, columns=col_names)
        df["Hand"] = pd.Series(hands).map({"*": "Left", "+": "Switch"}).fillna("Right").values

    # 日本語列名 → 英語
    df = df.rename(columns=COL_MAP)

    # IP を小数に変換
    if "IP" in df.columns:
        df["IP"] = df["IP"].apply(ip_to_decimal)

    # 数値変換
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # WHIP 計算
    if {"BB", "HA", "IP"}.issubset(df.columns):
        df["WHIP"] = ((df["BB"] + df["HA"]) / df["IP"].replace(0.0, float("nan"))).round(3)

    df["Team"] = team_ja
    return df


def fetch_all_teams(year: int) -> pd.DataFrame:
    dfs = []
    for team_ja, code in TEAM_INFO:
        print(f"  取得中: {team_ja} ({year})...")
        try:
            df = fetch_team(year, team_ja, code)
            if not df.empty:
                dfs.append(df)
        except Exception as e:
            print(f"  ERROR: {team_ja}: {e}")
        time.sleep(2)
    return pd.concat(dfs, axis=0, ignore_index=True) if dfs else pd.DataFrame()


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    print(f"=== {year}年の投手データを取得します ===")
    df = fetch_all_teams(year)
    os.makedirs("data", exist_ok=True)
    output_path = f"data/npb_pitcher_{year}.csv"
    df.to_csv(output_path, index=False)
    print(f"保存完了: {output_path}  ({len(df)}行)")
