import streamlit as st
import pandas as pd
import altair as alt
from pathlib import Path

BASE_DIR = Path(__file__).parent

st.set_page_config(page_title="NPB Stats Analysis", layout="wide")

TEAM_MAPPING = {
    "読売ジャイアンツ": "Yomiuri Giants",
    "阪神タイガース": "Hanshin Tigers",
    "広島東洋カープ": "Hiroshima Carp",
    "横浜DeNAベイスターズ": "Yokohama Bay Stars",
    "東京ヤクルトスワローズ": "Yakult Swallows",
    "中日ドラゴンズ": "Chunichi Dragons",
    "オリックス・バファローズ": "Orix Buffaloes",
    "千葉ロッテマリーンズ": "Chiba Lotte Marines",
    "福岡ソフトバンクホークス": "Fukuoka Softbank Hawks",
    "東北楽天ゴールデンイーグルス": "Tohoku Rakuten Golden Eagles",
    "埼玉西武ライオンズ": "Saitama Seibu Lions",
    "北海道日本ハムファイターズ": "Hokkaido Nippon Ham Fighters",
}

CENTRAL_LEAGUE = ["読売ジャイアンツ", "阪神タイガース", "広島東洋カープ", "横浜DeNAベイスターズ", "東京ヤクルトスワローズ", "中日ドラゴンズ"]
PACIFIC_LEAGUE = ["オリックス・バファローズ", "千葉ロッテマリーンズ", "福岡ソフトバンクホークス", "東北楽天ゴールデンイーグルス", "埼玉西武ライオンズ", "北海道日本ハムファイターズ"]

NUMERIC_COLS = ["G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "CS", "BB", "SO", "BA", "OBP", "SLG", "OPS", "TB", "SAC", "SF", "IBB", "HBP", "GDP"]


@st.cache_data(ttl=86400)
def load_csv(year: int) -> pd.DataFrame | None:
    path = BASE_DIR / "data" / f"npb_stats_{year}.csv"
    try:
        df = pd.read_csv(path)
        for col in NUMERIC_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        return df
    except FileNotFoundError:
        return None


st.sidebar.header("フィルター")
league = st.sidebar.radio("リーグ", ["全リーグ", "セ・リーグ", "パ・リーグ"])

if league == "セ・リーグ":
    available_teams = CENTRAL_LEAGUE
elif league == "パ・リーグ":
    available_teams = PACIFIC_LEAGUE
else:
    available_teams = list(TEAM_MAPPING.keys())

team_options = ["全球団"] + available_teams
default_team = "千葉ロッテマリーンズ" if "千葉ロッテマリーンズ" in available_teams else team_options[0]
default_team_index = team_options.index(default_team)
team_ja = st.sidebar.selectbox("球団", team_options, index=default_team_index)
year = st.sidebar.selectbox("年度", list(range(2025, 2014, -1)))

title_label = "全球団" if team_ja == "全球団" else team_ja
league_label = f"（{league}）" if league != "全リーグ" else ""
st.title(f"⚾ プロ野球成績分析{league_label}（{title_label}）")

df_all = load_csv(year)

if df_all is None:
    st.warning(
        f"{year}年のデータがまだ生成されていません。\n\n"
        f"ローカルで以下を実行してCSVを生成してください:\n\n"
        f"```\npython fetch_data_local.py {year}\n```"
    )
    st.stop()

if team_ja == "全球団":
    if league == "セ・リーグ":
        df = df_all[df_all["Team"].isin(CENTRAL_LEAGUE)].reset_index(drop=True)
    elif league == "パ・リーグ":
        df = df_all[df_all["Team"].isin(PACIFIC_LEAGUE)].reset_index(drop=True)
    else:
        df = df_all
else:
    df = df_all[df_all["Team"] == team_ja].reset_index(drop=True)

st.subheader(f"{year}年 打者成績一覧")
st.dataframe(df, use_container_width=True)

def bar_chart_sorted(data: pd.DataFrame, col: str, label: str):
    top20 = (
        data[["Name", col]]
        .dropna(subset=[col])
        .sort_values(col, ascending=False)
        .head(20)
    )
    chart = (
        alt.Chart(top20)
        .mark_bar()
        .encode(
            x=alt.X("Name:N", sort=None, title="選手名"),
            y=alt.Y(f"{col}:Q", title=label),
            tooltip=["Name", col],
        )
        .properties(height=400)
    )
    st.altair_chart(chart, use_container_width=True)


st.subheader(f"{year}年 本塁打数 上位20名")
if "HR" in df.columns and "Name" in df.columns:
    bar_chart_sorted(df, "HR", "本塁打")
else:
    st.warning("HRまたはNameカラムが見つかりませんでした。")

st.subheader(f"{year}年 安打数 上位20名")
if "H" in df.columns and "Name" in df.columns:
    bar_chart_sorted(df, "H", "安打")
else:
    st.warning("HまたはNameカラムが見つかりませんでした。")

st.subheader(f"{year}年 打率 上位20名")
if "BA" in df.columns and "Name" in df.columns:
    bar_chart_sorted(df, "BA", "打率")
else:
    st.warning("BAまたはNameカラムが見つかりませんでした。")
