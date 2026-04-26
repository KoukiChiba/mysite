import streamlit as st
import pandas as pd
import altair as alt
from pathlib import Path
import os
from typing import Optional, List

BASE_DIR = Path(__file__).parent

st.set_page_config(page_title="NPB Stats Analysis", layout="wide")

st.markdown("""
<style>
@media (max-width: 768px) {
    [data-testid="column"] {
        width: 100% !important;
        flex: 1 1 100% !important;
        min-width: 100% !important;
    }
    section[data-testid="stSidebar"] { font-size: 0.9rem; }
    button[data-baseweb="tab"] { font-size: 0.75rem !important; padding: 6px 8px !important; }
    [data-testid="stDataFrame"] { overflow-x: auto !important; }
    h1 { font-size: 1.3rem !important; }
}
</style>
""", unsafe_allow_html=True)

CENTRAL_LEAGUE = ["読売ジャイアンツ", "阪神タイガース", "広島東洋カープ",
                  "横浜DeNAベイスターズ", "東京ヤクルトスワローズ", "中日ドラゴンズ"]
PACIFIC_LEAGUE = ["オリックス・バファローズ", "千葉ロッテマリーンズ", "福岡ソフトバンクホークス",
                  "東北楽天ゴールデンイーグルス", "埼玉西武ライオンズ", "北海道日本ハムファイターズ"]
ALL_TEAMS = CENTRAL_LEAGUE + PACIFIC_LEAGUE

# ── 野手設定 ────────────────────────────────────────────
BATTER_NUMERIC = ["G","PA","AB","R","H","2B","3B","HR","RBI","SB","CS","BB","SO",
                  "BA","OBP","SLG","OPS","TB","SAC","SF","IBB","HBP","GDP"]
BATTER_RATE_STATS = {"BA","OBP","SLG","OPS"}
BATTER_METRICS = {
    "OPS": ("OPS", False),
    "打率 (BA)": ("BA", False),
    "出塁率 (OBP)": ("OBP", False),
    "長打率 (SLG)": ("SLG", False),
    "本塁打 (HR)": ("HR", False),
    "安打 (H)": ("H", False),
    "打点 (RBI)": ("RBI", False),
    "盗塁 (SB)": ("SB", False),
    "四球 (BB)": ("BB", False),
}

# ── 投手設定 ────────────────────────────────────────────
PITCHER_NUMERIC = ["G","W","L","SV","HLD","HP","CG","SHO","NHB","BF","IP",
                   "HA","HRA","BB","IBB","HBP","SO","WP","BK","R","ER","ERA","WPCT","WHIP"]
PITCHER_METRICS = {
    "防御率 (ERA)":   ("ERA",  True),
    "WHIP":           ("WHIP", True),
    "奪三振 (SO)":    ("SO",   False),
    "勝利 (W)":       ("W",    False),
    "セーブ (SV)":    ("SV",   False),
    "ホールド (HLD)": ("HLD",  False),
    "投球回 (IP)":    ("IP",   False),
    "被安打 (HA)":    ("HA",   True),
    "与四球 (BB)":    ("BB",   True),
    "失点 (R)":       ("R",    True),
}

SEASON_GAMES = 143


def project_batter_stats(df: pd.DataFrame, min_g: int = 10) -> pd.DataFrame:
    df = df[df["G"] >= min_g].copy()
    g = df["G"].clip(lower=1)
    for col in ["PA","AB","R","H","2B","3B","HR","RBI","SB","CS","BB","SO","TB","HBP","GDP"]:
        if col in df.columns:
            df[f"予測_{col}"] = (df[col] / g * SEASON_GAMES).round(0).astype("Int64")
    for col in ["BA","OBP","SLG","OPS"]:
        if col in df.columns:
            df[f"予測_{col}"] = df[col]
    return df


def project_pitcher_stats(df: pd.DataFrame, min_g: int = 5) -> pd.DataFrame:
    df = df[df["G"] >= min_g].copy()
    g = df["G"].clip(lower=1)
    for col in ["W","L","SV","HLD","BF","HA","HRA","BB","SO","R","ER"]:
        if col in df.columns:
            df[f"予測_{col}"] = (df[col] / g * SEASON_GAMES).round(0).astype("Int64")
    if "IP" in df.columns:
        df["予測_IP"] = (df["IP"] / g * SEASON_GAMES).round(1)
    if "予測_ER" in df.columns and "予測_IP" in df.columns:
        ip_s = df["予測_IP"].clip(lower=0.1)
        df["予測_ERA"] = (df["予測_ER"] * 9 / ip_s).round(2)
    if "予測_HA" in df.columns and "予測_BB" in df.columns and "予測_IP" in df.columns:
        ip_s = df["予測_IP"].clip(lower=0.1)
        df["予測_WHIP"] = ((df["予測_HA"] + df["予測_BB"]) / ip_s).round(3)
    return df


# ── データ読み込み ───────────────────────────────────────
def get_available_years(mode: str) -> List[int]:
    pattern = "npb_pitcher_*.csv" if mode == "投手" else "npb_stats_*.csv"
    return sorted([int(p.stem.split("_")[-1]) for p in (BASE_DIR / "data").glob(pattern)])


@st.cache_data(ttl=86400)
def load_csv(year: int, mode: str) -> Optional[pd.DataFrame]:
    fname = f"npb_pitcher_{year}.csv" if mode == "投手" else f"npb_stats_{year}.csv"
    path = BASE_DIR / "data" / fname
    numeric = PITCHER_NUMERIC if mode == "投手" else BATTER_NUMERIC
    try:
        df = pd.read_csv(path)
        for col in numeric:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        return df
    except FileNotFoundError:
        return None


@st.cache_data(ttl=86400)
def load_all_years(years: tuple, mode: str) -> pd.DataFrame:
    dfs = []
    for year in years:
        df = load_csv(year, mode)
        if df is not None:
            df = df.copy()
            df["Year"] = year
            dfs.append(df)
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


def filter_by_league(df: pd.DataFrame, league: str) -> pd.DataFrame:
    if league == "セ・リーグ":
        return df[df["Team"].isin(CENTRAL_LEAGUE)]
    elif league == "パ・リーグ":
        return df[df["Team"].isin(PACIFIC_LEAGUE)]
    return df


# ── サイドバー ──────────────────────────────────────────
st.sidebar.header("フィルター")
mode = st.sidebar.radio("種別", ["野手", "投手"])
st.sidebar.divider()
league = st.sidebar.radio("リーグ", ["全リーグ", "セ・リーグ", "パ・リーグ"])

available_teams = CENTRAL_LEAGUE if league == "セ・リーグ" else \
                  PACIFIC_LEAGUE  if league == "パ・リーグ" else ALL_TEAMS
team_ja = st.sidebar.selectbox("球団", ["全球団"] + available_teams, index=0)

available_years = get_available_years(mode)
year = st.sidebar.selectbox("年度", sorted(available_years, reverse=True))

# ── タイトル ─────────────────────────────────────────────
title_label = "全球団" if team_ja == "全球団" else team_ja
league_label = f"（{league}）" if league != "全リーグ" else ""
st.title(f"⚾ プロ野球成績分析{league_label}（{title_label}）")

df_all = load_csv(year, mode)
if df_all is None or df_all.empty:
    script = "fetch_pitcher_local.py" if mode == "投手" else "fetch_data_local.py"
    st.warning(f"{year}年のデータがありません。\n\n```\npython {script} {year}\n```")
    st.stop()

# 球団フィルター
if team_ja == "全球団":
    df = filter_by_league(df_all, league).reset_index(drop=True)
else:
    df = df_all[df_all["Team"] == team_ja].reset_index(drop=True)

# ── タブ ─────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(["📊 成績", "📈 推移", "🏟 チーム", "🔍 散布図", "🔮 予測", "💬 AIチャット"])

# ════════════════════════════════════════════════════════
# 野手モード
# ════════════════════════════════════════════════════════
if mode == "野手":
    METRICS = BATTER_METRICS

    with tab1:
        st.subheader(f"{year}年 打者成績一覧")
        st.dataframe(
            df.sort_values("G", ascending=False).reset_index(drop=True) if "G" in df.columns else df,
            use_container_width=True,
        )

        st.subheader(f"{year}年 指標ランキング（上位20名）")
        col_m, col_f = st.columns([2, 1])
        with col_m:
            metric_label = st.selectbox("指標", list(METRICS.keys()))
        metric_col, low_is_good = METRICS[metric_label]
        is_rate = metric_col in BATTER_RATE_STATS
        with col_f:
            min_pa = st.number_input("最低打席数", min_value=0, max_value=700,
                                      value=100 if is_rate else 0, step=10)
        if metric_col in df.columns:
            df_r = df[df["PA"] >= min_pa].copy() if min_pa > 0 else df.copy()
            top20 = (df_r[["Name","Team",metric_col]].dropna(subset=[metric_col])
                     .sort_values(metric_col, ascending=low_is_good).head(20))
            st.altair_chart(
                alt.Chart(top20).mark_bar().encode(
                    x=alt.X("Name:N", sort=top20["Name"].tolist(), title="選手名"),
                    y=alt.Y(f"{metric_col}:Q", title=metric_label),
                    color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                    tooltip=["Name","Team",metric_col],
                ).properties(height=400),
                use_container_width=True,
            )

    with tab2:
        st.subheader("選手年度別推移")
        df_ay = load_all_years(tuple(available_years), mode)
        q = st.text_input("選手名で検索（スペース・カンマ区切りで複数検索可）", placeholder="例: 鈴木 岡本　／　藤原,高部")
        if q:
            import re
            terms = [t for t in re.split(r"[,、\s]+", q.strip()) if t]
            pattern = "|".join(re.escape(t) for t in terms)
            matched = sorted(df_ay[df_ay["Name"].str.contains(pattern, na=False)]["Name"].unique())
            if not len(matched):
                st.warning("見つかりませんでした。")
            else:
                sel_list = st.multiselect("選手を選択（複数比較可）", matched, default=matched[:1])
                if sel_list:
                    dp = df_ay[df_ay["Name"].isin(sel_list)].sort_values(["Name","Year"]).reset_index(drop=True)
                    tl = st.selectbox("推移指標", list(METRICS.keys()), key="trend_m")
                    tc, _ = METRICS[tl]
                    if tc in dp.columns:
                        st.altair_chart(
                            alt.Chart(dp[["Name","Year","Team",tc,"PA"]].dropna(subset=[tc]))
                            .mark_line(point=True).encode(
                                x=alt.X("Year:O", title="年度"),
                                y=alt.Y(f"{tc}:Q", title=tl),
                                color=alt.Color("Name:N", title="選手", legend=alt.Legend(orient="bottom")),
                                tooltip=["Name","Year","Team",tc,"PA"],
                            ).properties(height=350),
                            use_container_width=True,
                        )
                    show = [c for c in ["Name","Year","Team","G","PA","HR","H","RBI","SB","BA","OBP","SLG","OPS"] if c in dp.columns]
                    st.dataframe(dp[show], use_container_width=True)
        else:
            st.info("選手名を入力すると年度別の推移グラフと成績一覧が表示されます。")

    with tab3:
        st.subheader(f"{year}年 チーム集計")
        base = filter_by_league(df_all, league)
        base = base[base["PA"] >= 10]

        def team_rate(g, n, d):
            nd, dd = g[n].sum(), g[d].sum()
            return round(nd / dd, 3) if dd > 0 else None

        records = []
        for team, grp in base.groupby("Team"):
            records.append({
                "球団": team, "選手数": len(grp),
                "本塁打": int(grp["HR"].sum()), "安打": int(grp["H"].sum()),
                "打点": int(grp["RBI"].sum()), "盗塁": int(grp["SB"].sum()),
                "四球": int(grp["BB"].sum()),
                "打率": team_rate(grp,"H","AB"),
                "OPS平均": round(grp["OPS"].mean(), 3),
            })
        agg = pd.DataFrame(records).sort_values("OPS平均", ascending=False).reset_index(drop=True)
        agg.index += 1
        st.dataframe(agg, use_container_width=True)
        col = st.selectbox("比較指標", ["OPS平均","本塁打","安打","打点","盗塁","四球","打率"], key="t_col")
        st.altair_chart(
            alt.Chart(agg.reset_index()).mark_bar().encode(
                x=alt.X("球団:N", sort="-y"), y=alt.Y(f"{col}:Q", title=col),
                tooltip=["球団", col],
            ).properties(height=350),
            use_container_width=True,
        )

    with tab4:
        st.subheader(f"{year}年 散布図")
        keys = list(METRICS.keys())
        c1, c2 = st.columns(2)
        with c1: xl = st.selectbox("X 軸", keys, index=keys.index("本塁打 (HR)"), key="sc_x")
        with c2: yl = st.selectbox("Y 軸", keys, index=keys.index("OPS"), key="sc_y")
        mp = st.number_input("最低打席数", 0, 700, 100, 10, key="sc_p")
        xc, _ = METRICS[xl]; yc, _ = METRICS[yl]
        dsc = (df[df["PA"] >= mp] if mp > 0 else df).dropna(subset=[xc, yc])
        if dsc.empty:
            st.warning("データがありません。最低打席数を下げてみてください。")
        else:
            st.altair_chart(
                alt.Chart(dsc).mark_circle(size=80, opacity=0.7).encode(
                    x=alt.X(f"{xc}:Q", title=xl), y=alt.Y(f"{yc}:Q", title=yl),
                    color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                    tooltip=["Name","Team","PA", xc, yc],
                ).properties(height=500).interactive(),
                use_container_width=True,
            )
            st.caption(f"対象: {len(dsc)} 選手（PA ≥ {mp}）　ドラッグでズーム、ダブルクリックでリセット")

    with tab5:
        st.subheader(f"{year}年 打者シーズン終了予測（{SEASON_GAMES}試合換算）")
        st.caption("現在のペースでシーズンを終えた場合の最終成績予測。カウント系は143試合換算、率系はそのまま表示。")

        min_g_b = st.number_input("最低出場試合数", min_value=1, max_value=143, value=15, step=5, key="pred_b_mg")

        df_proj = project_batter_stats(filter_by_league(df_all, league) if team_ja == "全球団" else df_all[df_all["Team"] == team_ja], min_g=min_g_b)

        if df_proj.empty:
            st.warning("対象選手がいません。最低出場試合数を下げてみてください。")
        else:
            pred_metric_map = {
                "本塁打 (HR)": ("予測_HR", False),
                "安打 (H)": ("予測_H", False),
                "打点 (RBI)": ("予測_RBI", False),
                "盗塁 (SB)": ("予測_SB", False),
                "四球 (BB)": ("予測_BB", False),
                "打率 (BA)": ("予測_BA", False),
                "OPS": ("予測_OPS", False),
                "出塁率 (OBP)": ("予測_OBP", False),
            }
            pred_label = st.selectbox("予測指標でランキング", list(pred_metric_map.keys()), key="pred_b_metric")
            pred_col, _ = pred_metric_map[pred_label]

            if pred_col in df_proj.columns:
                min_pa_pred = st.number_input("最低打席数（率系フィルター）", 0, 700, 50, 10, key="pred_b_pa") if "BA" in pred_label or "OPS" in pred_label or "OBP" in pred_label else 0
                df_rank = df_proj.copy()
                if min_pa_pred > 0 and "PA" in df_rank.columns:
                    df_rank = df_rank[df_rank["PA"] >= min_pa_pred]
                top20 = (df_rank[["Name","Team","G", pred_col]].dropna(subset=[pred_col])
                         .sort_values(pred_col, ascending=False).head(20).reset_index(drop=True))
                top20.index += 1
                st.altair_chart(
                    alt.Chart(top20.reset_index()).mark_bar().encode(
                        x=alt.X("Name:N", sort=top20["Name"].tolist(), title="選手名"),
                        y=alt.Y(f"{pred_col}:Q", title=pred_label),
                        color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                        tooltip=["Name","Team","G", pred_col],
                    ).properties(height=400),
                    use_container_width=True,
                )

            st.subheader("全選手 予測成績一覧")
            show_cols = [c for c in ["Name","Team","G","予測_PA","予測_HR","予測_H","予測_RBI","予測_SB","予測_BB","予測_BA","予測_OBP","予測_SLG","予測_OPS"] if c in df_proj.columns]
            st.dataframe(
                df_proj[show_cols].sort_values("予測_OPS", ascending=False).reset_index(drop=True),
                use_container_width=True,
            )

# ════════════════════════════════════════════════════════
# 投手モード
# ════════════════════════════════════════════════════════
else:
    METRICS = PITCHER_METRICS

    with tab1:
        st.subheader(f"{year}年 投手成績一覧")
        show = [c for c in ["Name","Team","G","W","L","SV","HLD","CG","SHO",
                             "IP","BF","HA","HRA","BB","SO","ERA","WHIP","Hand"] if c in df.columns]
        st.dataframe(df[show].sort_values("IP", ascending=False).reset_index(drop=True),
                     use_container_width=True)

        st.subheader(f"{year}年 指標ランキング（上位20名）")
        col_m, col_f = st.columns([2, 1])
        with col_m:
            metric_label = st.selectbox("指標", list(METRICS.keys()))
        metric_col, low_is_good = METRICS[metric_label]
        with col_f:
            min_ip = st.number_input("最低投球回", 0.0, 200.0, 10.0, 5.0)
        if metric_col in df.columns:
            df_r = df[df["IP"] >= min_ip].copy() if min_ip > 0 else df.copy()
            top20 = (df_r[["Name","Team","IP",metric_col]].dropna(subset=[metric_col])
                     .sort_values(metric_col, ascending=low_is_good).head(20))
            st.altair_chart(
                alt.Chart(top20).mark_bar().encode(
                    x=alt.X("Name:N", sort=top20["Name"].tolist(), title="投手名"),
                    y=alt.Y(f"{metric_col}:Q", title=metric_label),
                    color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                    tooltip=["Name","Team","IP",metric_col],
                ).properties(height=400),
                use_container_width=True,
            )

    with tab2:
        st.subheader("投手年度別推移")
        df_ay = load_all_years(tuple(available_years), mode)
        q = st.text_input("投手名で検索（スペース・カンマ区切りで複数検索可）", placeholder="例: 山本 田中　／　佐々木,今永")
        if q:
            import re
            terms = [t for t in re.split(r"[,、\s]+", q.strip()) if t]
            pattern = "|".join(re.escape(t) for t in terms)
            matched = sorted(df_ay[df_ay["Name"].str.contains(pattern, na=False)]["Name"].unique())
            if not len(matched):
                st.warning("見つかりませんでした。")
            else:
                sel_list = st.multiselect("投手を選択（複数比較可）", matched, default=matched[:1])
                if sel_list:
                    dp = df_ay[df_ay["Name"].isin(sel_list)].sort_values(["Name","Year"]).reset_index(drop=True)
                    tl = st.selectbox("推移指標", list(METRICS.keys()), key="trend_m")
                    tc, _ = METRICS[tl]
                    if tc in dp.columns:
                        st.altair_chart(
                            alt.Chart(dp[["Name","Year","Team",tc,"IP"]].dropna(subset=[tc]))
                            .mark_line(point=True).encode(
                                x=alt.X("Year:O", title="年度"),
                                y=alt.Y(f"{tc}:Q", title=tl),
                                color=alt.Color("Name:N", title="投手", legend=alt.Legend(orient="bottom")),
                                tooltip=["Name","Year","Team",tc,"IP"],
                            ).properties(height=350),
                            use_container_width=True,
                        )
                    show = [c for c in ["Name","Year","Team","G","W","L","SV","HLD","IP","SO","BB","ERA","WHIP"] if c in dp.columns]
                    st.dataframe(dp[show], use_container_width=True)
        else:
            st.info("投手名を入力すると年度別の推移グラフと成績一覧が表示されます。")

    with tab3:
        st.subheader(f"{year}年 チーム投手集計")
        base = filter_by_league(df_all, league)
        records = []
        for team, grp in base.groupby("Team"):
            tip = grp["IP"].sum(); ter = grp["ER"].sum()
            records.append({
                "球団": team, "投手数": len(grp),
                "勝利合計": int(grp["W"].sum()),
                "セーブ合計": int(grp["SV"].sum()),
                "ホールド合計": int(grp["HLD"].sum()),
                "奪三振合計": int(grp["SO"].sum()),
                "投球回合計": round(tip, 1),
                "チームERA": round(ter * 9 / tip, 2) if tip > 0 else None,
                "WHIP平均": round(grp["WHIP"].mean(), 3),
            })
        agg = pd.DataFrame(records).sort_values("チームERA").reset_index(drop=True)
        agg.index += 1
        st.dataframe(agg, use_container_width=True)
        col = st.selectbox("比較指標", ["チームERA","奪三振合計","勝利合計","セーブ合計","ホールド合計","WHIP平均"], key="t_col")
        low = col in {"チームERA","WHIP平均"}
        st.altair_chart(
            alt.Chart(agg.reset_index()).mark_bar().encode(
                x=alt.X("球団:N", sort="y" if low else "-y"),
                y=alt.Y(f"{col}:Q", title=col),
                tooltip=["球団", col],
            ).properties(height=350),
            use_container_width=True,
        )

    with tab4:
        st.subheader(f"{year}年 散布図")
        keys = list(METRICS.keys())
        c1, c2 = st.columns(2)
        with c1: xl = st.selectbox("X 軸", keys, index=keys.index("奪三振 (SO)"), key="sc_x")
        with c2: yl = st.selectbox("Y 軸", keys, index=keys.index("防御率 (ERA)"), key="sc_y")
        mp = st.number_input("最低投球回", 0.0, 200.0, 10.0, 5.0, key="sc_p")
        xc, _ = METRICS[xl]; yc, _ = METRICS[yl]
        dsc = (df[df["IP"] >= mp] if mp > 0 else df).dropna(subset=[xc, yc])
        if dsc.empty:
            st.warning("データがありません。最低投球回を下げてみてください。")
        else:
            st.altair_chart(
                alt.Chart(dsc).mark_circle(size=80, opacity=0.7).encode(
                    x=alt.X(f"{xc}:Q", title=xl), y=alt.Y(f"{yc}:Q", title=yl),
                    color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                    tooltip=["Name","Team","IP", xc, yc],
                ).properties(height=500).interactive(),
                use_container_width=True,
            )
            st.caption(f"対象: {len(dsc)} 投手（IP ≥ {mp}）　ドラッグでズーム、ダブルクリックでリセット")

    with tab5:
        st.subheader(f"{year}年 投手シーズン終了予測（{SEASON_GAMES}試合換算）")
        st.caption("現在のペースでシーズンを終えた場合の最終成績予測。ERA・WHIPは予測IP・ERから再計算。")

        min_g_p = st.number_input("最低登板試合数", min_value=1, max_value=143, value=5, step=3, key="pred_p_mg")

        df_proj_p = project_pitcher_stats(filter_by_league(df_all, league) if team_ja == "全球団" else df_all[df_all["Team"] == team_ja], min_g=min_g_p)

        if df_proj_p.empty:
            st.warning("対象投手がいません。最低登板試合数を下げてみてください。")
        else:
            pred_pitch_map = {
                "勝利 (W)": ("予測_W", False),
                "奪三振 (SO)": ("予測_SO", False),
                "セーブ (SV)": ("予測_SV", False),
                "ホールド (HLD)": ("予測_HLD", False),
                "投球回 (IP)": ("予測_IP", False),
                "防御率 (ERA)": ("予測_ERA", True),
                "WHIP": ("予測_WHIP", True),
            }
            pred_label_p = st.selectbox("予測指標でランキング", list(pred_pitch_map.keys()), key="pred_p_metric")
            pred_col_p, low_p = pred_pitch_map[pred_label_p]

            if pred_col_p in df_proj_p.columns:
                min_ip_pred = st.number_input("最低投球回（率系フィルター）", 0.0, 200.0, 20.0, 5.0, key="pred_p_ip") if "ERA" in pred_label_p or "WHIP" in pred_label_p else 0.0
                df_rank_p = df_proj_p.copy()
                if min_ip_pred > 0 and "IP" in df_rank_p.columns:
                    df_rank_p = df_rank_p[df_rank_p["IP"] >= min_ip_pred]
                top20_p = (df_rank_p[["Name","Team","G", pred_col_p]].dropna(subset=[pred_col_p])
                           .sort_values(pred_col_p, ascending=low_p).head(20).reset_index(drop=True))
                top20_p.index += 1
                st.altair_chart(
                    alt.Chart(top20_p.reset_index()).mark_bar().encode(
                        x=alt.X("Name:N", sort=top20_p["Name"].tolist(), title="投手名"),
                        y=alt.Y(f"{pred_col_p}:Q", title=pred_label_p),
                        color=alt.Color("Team:N", title="球団", legend=alt.Legend(orient="bottom")),
                        tooltip=["Name","Team","G", pred_col_p],
                    ).properties(height=400),
                    use_container_width=True,
                )

            st.subheader("全投手 予測成績一覧")
            show_cols_p = [c for c in ["Name","Team","G","予測_IP","予測_W","予測_L","予測_SV","予測_HLD","予測_SO","予測_BB","予測_HA","予測_ERA","予測_WHIP"] if c in df_proj_p.columns]
            st.dataframe(
                df_proj_p[show_cols_p].sort_values("予測_ERA").reset_index(drop=True),
                use_container_width=True,
            )

# ════════════════════════════════════════════════════════
# AIチャット
# ════════════════════════════════════════════════════════
with tab6:
    st.subheader("💬 AIチャット — データについて質問する")

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        st.warning("環境変数 `GEMINI_API_KEY` が設定されていません。")
        st.stop()

    try:
        from google import genai as _genai
        _client = _genai.Client(api_key=api_key)
    except Exception as e:
        st.error(f"Gemini の初期化に失敗しました: {e}")
        st.stop()

    # 現在表示中のデータをコンテキストとして渡す
    ctx_df = df.copy()
    data_str = ctx_df.to_csv(index=False) if len(ctx_df) <= 200 else ctx_df.head(200).to_csv(index=False)
    system_prompt = f"""あなたはプロ野球（NPB）の成績データを分析するアシスタントです。
以下は現在表示中の{year}年・{mode}の成績データです（{title_label}・{league}）。
このデータをもとにユーザーの質問に日本語で答えてください。

```
{data_str}
```
"""

    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    # チャット履歴の表示
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if prompt := st.chat_input("例：OPSが一番高い選手は？　打点トップ5を教えて"):
        st.session_state.chat_history.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("考え中..."):
                try:
                    # 会話履歴をGemini形式に変換
                    contents = [{"role": "user", "parts": [{"text": system_prompt + "\n\nユーザーの質問: " + prompt}]}]
                    for h in st.session_state.chat_history[:-1]:
                        role = "user" if h["role"] == "user" else "model"
                        contents.append({"role": role, "parts": [{"text": h["content"]}]})
                    contents.append({"role": "user", "parts": [{"text": prompt}]})

                    response = _client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=contents,
                    )
                    answer = response.text
                except Exception as e:
                    answer = f"エラーが発生しました: {e}"

                st.markdown(answer)
                st.session_state.chat_history.append({"role": "assistant", "content": answer})

    if st.session_state.chat_history:
        if st.button("会話をリセット"):
            st.session_state.chat_history = []
            st.rerun()
