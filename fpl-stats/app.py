import os
import re
from pathlib import Path
from typing import Optional

import altair as alt
import pandas as pd
import streamlit as st

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

st.set_page_config(page_title="FPL Stats Analysis", layout="wide")

st.markdown("""
<style>
@media (max-width: 768px) {
    /* カラムを縦積みに */
    [data-testid="column"] {
        width: 100% !important;
        flex: 1 1 100% !important;
        min-width: 100% !important;
    }
    /* サイドバーのフォントを少し小さく */
    section[data-testid="stSidebar"] { font-size: 0.9rem; }
    /* タブのフォントサイズを縮小 */
    button[data-baseweb="tab"] { font-size: 0.75rem !important; padding: 6px 8px !important; }
    /* データフレームの横スクロールを有効に */
    [data-testid="stDataFrame"] { overflow-x: auto !important; }
    /* タイトルを小さく */
    h1 { font-size: 1.3rem !important; }
}
</style>
""", unsafe_allow_html=True)

POSITIONS = ["GK", "DEF", "MID", "FWD"]

SEASON_METRICS = {
    "合計ポイント": ("total_points", False),
    "ゴール数": ("goals_scored", False),
    "アシスト数": ("assists", False),
    "出場時間 (分)": ("minutes", False),
    "クリーンシート": ("clean_sheets", False),
    "ボーナスポイント": ("bonus", False),
    "ICTインデックス": ("ict_index", False),
    "クリエイティビティ": ("creativity", False),
    "インフルエンス": ("influence", False),
    "スレット": ("threat", False),
    "選出率 (%)": ("selected_by_percent", False),
}

GW_METRICS = {
    "xG (期待ゴール)": ("expected_goals", False),
    "xA (期待アシスト)": ("expected_assists", False),
    "xGI (ゴール関与)": ("expected_goal_involvements", False),
    "合計ポイント": ("total_points", False),
    "ゴール数": ("goals_scored", False),
    "アシスト数": ("assists", False),
    "出場時間 (分)": ("minutes", False),
    "クリーンシート": ("clean_sheets", False),
    "ボーナス": ("bonus", False),
}

TOTAL_GW = 38


def get_available_seasons() -> list:
    files = sorted(DATA_DIR.glob("players_*.csv"))
    return [f.stem.replace("players_", "") for f in files]


@st.cache_data(ttl=86400)
def load_players(season: str) -> Optional[pd.DataFrame]:
    path = DATA_DIR / f"players_{season}.csv"
    if not path.exists():
        return None
    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin-1")
    df["name"] = df["first_name"] + " " + df["second_name"]
    df["season"] = season
    for col in SEASON_METRICS.values():
        if col[0] in df.columns:
            df[col[0]] = pd.to_numeric(df[col[0]], errors="coerce")
    if "now_cost" in df.columns:
        df["price"] = df["now_cost"] / 10
    # team / element_type がなければGWデータから補完
    gw = load_gw(season)
    if gw is not None:
        fill_cols = {}
        if "team" not in df.columns and "team" in gw.columns:
            fill_cols["team"] = gw.sort_values("GW").groupby("name")["team"].last()
        if "element_type" not in df.columns and "position" in gw.columns:
            fill_cols["element_type"] = gw.groupby("name")["position"].first()
        if fill_cols:
            sup = pd.DataFrame(fill_cols).reset_index()
            df = df.merge(sup, on="name", how="left")
    if "element_type" not in df.columns:
        df["element_type"] = "UNK"
    return df


@st.cache_data(ttl=86400)
def load_gw(season: str) -> Optional[pd.DataFrame]:
    path = DATA_DIR / f"gw_{season}.csv"
    if not path.exists():
        return None
    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin-1")
    df["season"] = season
    for col in GW_METRICS.values():
        if col[0] in df.columns:
            df[col[0]] = pd.to_numeric(df[col[0]], errors="coerce")
    if "GW" not in df.columns and "round" in df.columns:
        df["GW"] = df["round"]
    return df


@st.cache_data(ttl=86400)
def load_all_seasons(seasons: tuple) -> pd.DataFrame:
    dfs = [load_players(s) for s in seasons]
    dfs = [d for d in dfs if d is not None]
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


# ── サイドバー ──────────────────────────────────────────
st.sidebar.header("フィルター")
available_seasons = get_available_seasons()

if not available_seasons:
    st.error("データがありません。`python fetch_data.py` を実行してください。")
    st.stop()

season = st.sidebar.selectbox("シーズン", sorted(available_seasons, reverse=True))
df_all = load_players(season)

if df_all is None or df_all.empty:
    st.warning(f"{season} のデータがありません。\n\n```\npython3 fetch_data.py {season}\n```")
    st.stop()

all_teams = sorted(df_all["team"].dropna().unique()) if "team" in df_all.columns else []
team_col = "team" if "team" in df_all.columns else None

pos_filter = st.sidebar.multiselect(
    "ポジション", POSITIONS, default=POSITIONS
)
team_filter = st.sidebar.selectbox("クラブ", ["全クラブ"] + all_teams)

# フィルター適用（element_typeが不明=UNKの場合は除外しない）
df = df_all[df_all["element_type"].isin(pos_filter + ["UNK"])].copy()
if team_filter != "全クラブ" and team_col:
    df = df[df[team_col] == team_filter]

# ── タイトル ─────────────────────────────────────────────
pos_label = "/".join(pos_filter) if len(pos_filter) < 4 else "全ポジション"
st.title(f"⚽ FPL Stats Analysis ({season}) — {pos_label}")

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(
    ["📊 成績", "📈 推移", "🏟 クラブ", "🔍 散布図", "📅 GW", "💬 AIチャット"]
)

# ════════════════════════════════════════════════
# Tab1: 成績一覧 & ランキング
# ════════════════════════════════════════════════
with tab1:
    st.subheader(f"{season} 選手成績一覧")
    show_cols = [c for c in [
        "name", "element_type", "team", "price",
        "total_points", "minutes", "goals_scored", "assists",
        "clean_sheets", "bonus", "ict_index", "selected_by_percent",
    ] if c in df.columns]
    col_labels = {
        "name": "選手名", "element_type": "ポジション", "team": "クラブ",
        "price": "価格(M£)", "total_points": "Pts", "minutes": "出場分",
        "goals_scored": "G", "assists": "A", "clean_sheets": "CS",
        "bonus": "ボーナス", "ict_index": "ICT", "selected_by_percent": "選出%",
    }
    st.dataframe(
        df[show_cols].rename(columns=col_labels)
        .sort_values("Pts", ascending=False)
        .reset_index(drop=True),
        use_container_width=True,
    )

    st.subheader(f"{season} 指標ランキング（上位20名）")
    col_m, col_f = st.columns([2, 1])
    with col_m:
        metric_label = st.selectbox("指標", list(SEASON_METRICS.keys()), key="r_metric")
    metric_col, _ = SEASON_METRICS[metric_label]
    with col_f:
        min_min = st.number_input("最低出場時間(分)", 0, 3000, 90, 45, key="r_min")

    if metric_col in df.columns:
        df_r = df[df["minutes"] >= min_min].copy() if min_min > 0 else df.copy()
        r_cols = [c for c in ["name", "element_type", "team", metric_col] if c in df_r.columns]
        top20 = (
            df_r[r_cols]
            .dropna(subset=[metric_col])
            .sort_values(metric_col, ascending=False)
            .head(20)
        )
        if not top20.empty:
            has_team = "team" in top20.columns
            _legend = alt.Legend(orient="bottom")
            color_enc = alt.Color("team:N", title="クラブ", legend=_legend) if has_team else alt.Color("element_type:N", title="ポジション", legend=_legend)
            tt = [c for c in ["name", "element_type", "team", metric_col] if c in top20.columns]
            st.altair_chart(
                alt.Chart(top20).mark_bar().encode(
                    x=alt.X("name:N", sort=top20["name"].tolist(), title="選手名"),
                    y=alt.Y(f"{metric_col}:Q", title=metric_label),
                    color=color_enc,
                    tooltip=tt,
                ).properties(height=400),
                use_container_width=True,
            )

# ════════════════════════════════════════════════
# Tab2: シーズン別推移
# ════════════════════════════════════════════════
with tab2:
    st.subheader("選手シーズン別推移")
    df_ay = load_all_seasons(tuple(available_seasons))

    q = st.text_input(
        "選手名で検索（スペース・カンマ区切りで複数検索可）",
        placeholder="例: Haaland / Salah, Mané",
        key="trend_q",
    )
    if q:
        terms = [t for t in re.split(r"[,\s]+", q.strip()) if t]
        pattern = "|".join(re.escape(t) for t in terms)
        matched = sorted(
            df_ay[df_ay["name"].str.contains(pattern, case=False, na=False)]["name"].unique()
        )
        if not matched:
            st.warning("見つかりませんでした。")
        else:
            sel = st.multiselect("選手を選択（複数比較可）", matched, default=matched[:1])
            if sel:
                dp = df_ay[df_ay["name"].isin(sel)].sort_values(["name", "season"])
                tl = st.selectbox("推移指標", list(SEASON_METRICS.keys()), key="trend_m")
                tc, _ = SEASON_METRICS[tl]
                if tc in dp.columns:
                    st.altair_chart(
                        alt.Chart(dp[["name", "season", "team", tc, "minutes"]].dropna(subset=[tc]))
                        .mark_line(point=True)
                        .encode(
                            x=alt.X("season:O", title="シーズン"),
                            y=alt.Y(f"{tc}:Q", title=tl),
                            color=alt.Color("name:N", title="選手", legend=alt.Legend(orient="bottom")),
                            tooltip=["name", "season", "team", tc, "minutes"],
                        )
                        .properties(height=350),
                        use_container_width=True,
                    )
                show = [c for c in [
                    "name", "season", "team", "element_type", "total_points",
                    "minutes", "goals_scored", "assists", "clean_sheets", "ict_index",
                ] if c in dp.columns]
                st.dataframe(dp[show].reset_index(drop=True), use_container_width=True)
    else:
        st.info("選手名を入力するとシーズン別の推移グラフが表示されます。")

# ════════════════════════════════════════════════
# Tab3: クラブ集計
# ════════════════════════════════════════════════
with tab3:
    st.subheader(f"{season} クラブ別集計")
    base = df_all[df_all["element_type"].isin(pos_filter + ["UNK"])].copy()
    base = base[base["minutes"] >= 45]

    if "team" not in base.columns:
        st.info("このシーズンはクラブ情報がありません。")
        st.stop()

    records = []
    for team, grp in base.groupby("team"):
        records.append({
            "クラブ": team,
            "選手数": len(grp),
            "合計Pts": int(grp["total_points"].sum()),
            "ゴール計": int(grp["goals_scored"].sum()),
            "アシスト計": int(grp["assists"].sum()),
            "CS計": int(grp["clean_sheets"].sum()),
            "ボーナス計": int(grp["bonus"].sum()),
            "ICT平均": round(grp["ict_index"].mean(), 1),
        })
    agg = pd.DataFrame(records).sort_values("合計Pts", ascending=False).reset_index(drop=True)
    agg.index += 1
    st.dataframe(agg, use_container_width=True)

    col_t = st.selectbox("比較指標", ["合計Pts", "ゴール計", "アシスト計", "CS計", "ICT平均"], key="t_col")
    st.altair_chart(
        alt.Chart(agg.reset_index()).mark_bar().encode(
            x=alt.X("クラブ:N", sort="-y"),
            y=alt.Y(f"{col_t}:Q", title=col_t),
            tooltip=["クラブ", col_t],
        ).properties(height=350),
        use_container_width=True,
    )

# ════════════════════════════════════════════════
# Tab4: 散布図
# ════════════════════════════════════════════════
with tab4:
    st.subheader(f"{season} 散布図")
    df_gw4 = load_gw(season)
    use_gw = df_gw4 is not None and "expected_goals" in df_gw4.columns

    if use_gw:
        # GWデータを集計してシーズン合計xG/xAを付与
        gw_agg = (
            df_gw4.groupby("name")[["expected_goals", "expected_assists", "expected_goal_involvements"]]
            .sum()
            .reset_index()
        )
        df_sc = df.merge(gw_agg, on="name", how="left")
        sc_metrics = {
            "xG (期待ゴール)": "expected_goals",
            "xA (期待アシスト)": "expected_assists",
            "xGI": "expected_goal_involvements",
            "合計ポイント": "total_points",
            "ゴール数": "goals_scored",
            "アシスト数": "assists",
            "ICT": "ict_index",
            "クリエイティビティ": "creativity",
        }
    else:
        df_sc = df.copy()
        sc_metrics = {
            "合計ポイント": "total_points",
            "ゴール数": "goals_scored",
            "アシスト数": "assists",
            "ICT": "ict_index",
            "クリエイティビティ": "creativity",
            "インフルエンス": "influence",
        }

    sc_keys = list(sc_metrics.keys())
    c1, c2 = st.columns(2)
    with c1:
        xl = st.selectbox("X 軸", sc_keys, index=0, key="sc_x")
    with c2:
        yl = st.selectbox("Y 軸", sc_keys, index=min(1, len(sc_keys) - 1), key="sc_y")
    mp = st.number_input("最低出場分", 0, 3000, 90, 90, key="sc_p")

    xc, yc = sc_metrics[xl], sc_metrics[yl]
    dsc = (df_sc[df_sc["minutes"] >= mp] if mp > 0 else df_sc).dropna(subset=[xc, yc])

    if dsc.empty:
        st.warning("データがありません。最低出場分を下げてみてください。")
    else:
        tt = ["name", "element_type", "team", "minutes", xc, yc]
        tt = [c for c in tt if c in dsc.columns]
        st.altair_chart(
            alt.Chart(dsc).mark_circle(size=80, opacity=0.7).encode(
                x=alt.X(f"{xc}:Q", title=xl),
                y=alt.Y(f"{yc}:Q", title=yl),
                color=alt.Color("element_type:N", title="ポジション", legend=alt.Legend(orient="bottom")),
                tooltip=tt,
            ).properties(height=500).interactive(),
            use_container_width=True,
        )
        st.caption(f"対象: {len(dsc)} 選手（{mp}分以上）　ドラッグでズーム、ダブルクリックでリセット")

# ════════════════════════════════════════════════
# Tab5: GW別推移
# ════════════════════════════════════════════════
with tab5:
    st.subheader(f"{season} GW別推移")
    df_gw = load_gw(season)

    if df_gw is None or df_gw.empty:
        st.warning("GWデータがありません。")
    else:
        q5 = st.text_input(
            "選手名で検索（スペース・カンマ区切りで複数検索可）",
            placeholder="例: Haaland / Salah, Palmer",
            key="gw_q",
        )
        if q5:
            terms5 = [t for t in re.split(r"[,\s]+", q5.strip()) if t]
            pattern5 = "|".join(re.escape(t) for t in terms5)
            matched5 = sorted(
                df_gw[df_gw["name"].str.contains(pattern5, case=False, na=False)]["name"].unique()
            )
            if not matched5:
                st.warning("見つかりませんでした。")
            else:
                sel5 = st.multiselect("選手を選択（複数比較可）", matched5, default=matched5[:1])
                gw_m_label = st.selectbox("指標", list(GW_METRICS.keys()), key="gw_m")
                gw_mc, _ = GW_METRICS[gw_m_label]

                if sel5 and gw_mc in df_gw.columns:
                    dp5 = df_gw[df_gw["name"].isin(sel5)].sort_values(["name", "GW"])
                    st.altair_chart(
                        alt.Chart(dp5[["name", "GW", "team", gw_mc]].dropna(subset=[gw_mc]))
                        .mark_line(point=True)
                        .encode(
                            x=alt.X("GW:O", title="ゲームウィーク"),
                            y=alt.Y(f"{gw_mc}:Q", title=gw_m_label),
                            color=alt.Color("name:N", title="選手", legend=alt.Legend(orient="bottom")),
                            tooltip=["name", "GW", "team", gw_mc],
                        )
                        .properties(height=350),
                        use_container_width=True,
                    )

                    # 累計グラフ
                    if st.checkbox("累計で表示", key="gw_cum"):
                        dp5_cum = dp5.copy()
                        dp5_cum[f"{gw_mc}_cum"] = dp5_cum.groupby("name")[gw_mc].cumsum()
                        st.altair_chart(
                            alt.Chart(dp5_cum[["name", "GW", f"{gw_mc}_cum"]].dropna())
                            .mark_line(point=True)
                            .encode(
                                x=alt.X("GW:O", title="GW"),
                                y=alt.Y(f"{gw_mc}_cum:Q", title=f"{gw_m_label}（累計）"),
                                color=alt.Color("name:N", legend=alt.Legend(orient="bottom")),
                                tooltip=["name", "GW", f"{gw_mc}_cum"],
                            )
                            .properties(height=300),
                            use_container_width=True,
                        )

                    show5 = [c for c in [
                        "name", "GW", "team", "total_points", "minutes",
                        "goals_scored", "assists", "expected_goals", "expected_assists",
                        "clean_sheets", "bonus",
                    ] if c in dp5.columns]
                    st.dataframe(dp5[show5].reset_index(drop=True), use_container_width=True)
        else:
            st.info("選手名を入力するとGW単位の推移グラフが表示されます。")

# ════════════════════════════════════════════════
# Tab6: AIチャット
# ════════════════════════════════════════════════
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

    ctx_df = df.copy()
    data_str = ctx_df.to_csv(index=False) if len(ctx_df) <= 200 else ctx_df.head(200).to_csv(index=False)
    system_prompt = f"""あなたはFantasy Premier League（FPL）の選手データを分析するアシスタントです。
以下は現在表示中の{season}シーズンの選手データです（{pos_label}・{team_filter}）。
このデータをもとにユーザーの質問に日本語で答えてください。

```
{data_str}
```
"""

    if "fpl_chat_history" not in st.session_state:
        st.session_state.fpl_chat_history = []

    for msg in st.session_state.fpl_chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if prompt := st.chat_input("例：ポイントが一番高い選手は？　GKのおすすめは？"):
        st.session_state.fpl_chat_history.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("考え中..."):
                try:
                    contents = [{"role": "user", "parts": [{"text": system_prompt + "\n\nユーザーの質問: " + prompt}]}]
                    for h in st.session_state.fpl_chat_history[:-1]:
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
                st.session_state.fpl_chat_history.append({"role": "assistant", "content": answer})

    if st.session_state.fpl_chat_history:
        if st.button("会話をリセット"):
            st.session_state.fpl_chat_history = []
            st.rerun()
