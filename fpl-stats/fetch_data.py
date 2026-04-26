"""
vaastav/Fantasy-Premier-League リポジトリから各シーズンのCSVをダウンロードする。

使い方:
  python fetch_data.py              # 全シーズン取得
  python fetch_data.py 2024-25      # 特定シーズンのみ
"""
import sys
import time
from pathlib import Path
import requests

BASE_URL = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data"
SEASONS = [
    "2016-17", "2017-18", "2018-19", "2019-20",
    "2020-21", "2021-22", "2022-23", "2023-24", "2024-25",
]
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def download(url: str, dest: Path) -> bool:
    if dest.exists():
        print(f"  skip (exists): {dest.name}")
        return True
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            dest.write_bytes(r.content)
            print(f"  saved: {dest.name}")
            return True
        else:
            print(f"  not found (HTTP {r.status_code}): {url}")
            return False
    except Exception as e:
        print(f"  error: {e}")
        return False


def fetch_season(season: str):
    print(f"\n=== {season} ===")
    download(
        f"{BASE_URL}/{season}/cleaned_players.csv",
        DATA_DIR / f"players_{season}.csv",
    )
    # merged_gw.csv (新形式) or merged_gws.csv (旧形式) を試みる
    ok = download(
        f"{BASE_URL}/{season}/gws/merged_gw.csv",
        DATA_DIR / f"gw_{season}.csv",
    )
    if not ok:
        download(
            f"{BASE_URL}/{season}/gws/merged_gws.csv",
            DATA_DIR / f"gw_{season}.csv",
        )
    time.sleep(0.3)


if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else SEASONS
    for s in targets:
        fetch_season(s)
    print("\nDone.")
