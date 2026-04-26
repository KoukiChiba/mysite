"""
ローカルで実行してNPBデータをCSVに保存するスクリプト。
データソース: npb.jp（baseball-reference.com はCloudflare でブロックされるため変更）

使い方:
    python3 fetch_data_local.py 2024
    python3 fetch_data_local.py 2023

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

# (日本語名, チームコード) ※ idb1_ = 1軍データ（全12球団共通）
TEAM_INFO = [
    ("読売ジャイアンツ",           "g"),
    ("阪神タイガース",             "t"),
    ("広島東洋カープ",             "c"),
    ("横浜DeNAベイスターズ",       "db"),
    ("東京ヤクルトスワローズ",     "s"),
    ("中日ドラゴンズ",             "d"),
    ("千葉ロッテマリーンズ",       "m"),
    ("福岡ソフトバンクホークス",   "h"),
    ("北海道日本ハムファイターズ", "f"),
    ("東北楽天ゴールデンイーグルス", "e"),
    ("埼玉西武ライオンズ",         "l"),
    ("オリックス・バファローズ",   "b"),
]

COL_MAP = {
    "選手": "Name",
    "選\u3000手": "Name",  # 2024以前は全角スペース入り
    "試合": "G",
    "打席": "PA",
    "打数": "AB",
    "得点": "R",
    "安打": "H",
    "二塁打": "2B",
    "三塁打": "3B",
    "本塁打": "HR",
    "塁打": "TB",
    "打点": "RBI",
    "盗塁": "SB",
    "盗塁刺": "CS",
    "犠打": "SAC",
    "犠飛": "SF",
    "四球": "BB",
    "故意四": "IBB",
    "死球": "HBP",
    "三振": "SO",
    "併殺打": "GDP",
    "打率": "BA",
    "長打率": "SLG",
    "出塁率": "OBP",
}


def fetch_team(year: int, team_ja: str, code: str) -> pd.DataFrame:
    url = f"https://npb.jp/bis/{year}/stats/idb1_{code}.html"
    r = requests.get(url, headers=HEADERS, timeout=15)
    # 404 の場合、コードに "s" を付けて再試行（例: 2015-2017 のオリックス b→bs）
    if r.status_code == 404:
        alt_url = f"https://npb.jp/bis/{year}/stats/idb1_{code}s.html"
        r = requests.get(alt_url, headers=HEADERS, timeout=15)
    r.raise_for_status()

    soup = BeautifulSoup(r.content, "lxml")
    table = soup.find_all("table")[0]
    rows = table.find_all("tr")

    # ヘッダー行の検出: <th>があれば新形式(2025~)、なければ旧形式(~2024)
    if rows[0].find("th"):
        # 新形式: row0=ヘッダー(th), row1~=データ, 利き手は名前に埋め込み(*名前)
        col_names = [th.get_text(strip=True) for th in rows[0].find_all("th")]
        data_rows = rows[1:]
        embedded_hand = True
    else:
        # 旧形式: row0=注記, row1=ヘッダー(td), row2~=データ, 先頭列が利き手
        col_names = [td.get_text(strip=True) for td in rows[1].find_all(["th", "td"])]
        data_rows = rows[2:]
        embedded_hand = False

    data = []
    for row in data_rows:
        cells = [td.get_text(strip=True) for td in row.find_all(["th", "td"])]
        if len(cells) == len(col_names):
            data.append(cells)

    df = pd.DataFrame(data, columns=col_names)

    if embedded_hand:
        # 名前の先頭の * や + を利き手フラグとして抽出
        name_col = "選手"
        df["Hand"] = df[name_col].str.extract(r"^([*+])")[0].map({"*": "Left", "+": "Switch"}).fillna("Right")
        df[name_col] = df[name_col].str.lstrip("*+").str.strip()
    else:
        # 先頭の空列を利き手列として変換し削除
        first_col = col_names[0]
        df["Hand"] = df[first_col].map({"*": "Left", "+": "Switch"}).fillna("Right")
        df = df.drop(columns=[first_col])

    # 日本語列名を英語に変換
    df = df.rename(columns=COL_MAP)

    # OPS を計算
    df["SLG"] = pd.to_numeric(df["SLG"], errors="coerce")
    df["OBP"] = pd.to_numeric(df["OBP"], errors="coerce")
    df["OPS"] = (df["SLG"] + df["OBP"]).round(3)

    df["Team"] = team_ja
    return df


def fetch_all_teams(year: int) -> pd.DataFrame:
    dfs = []
    for team_ja, code in TEAM_INFO:
        print(f"  取得中: {team_ja} ({year})...")
        try:
            df = fetch_team(year, team_ja, code)
            dfs.append(df)
        except Exception as e:
            print(f"  ERROR: {team_ja}: {e}")
        time.sleep(2)
    return pd.concat(dfs, axis=0, ignore_index=True)


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    print(f"=== {year}年のデータを取得します ===")
    df = fetch_all_teams(year)
    os.makedirs("data", exist_ok=True)
    output_path = f"data/npb_stats_{year}.csv"
    df.to_csv(output_path, index=False)
    print(f"保存完了: {output_path}  ({len(df)}行)")
