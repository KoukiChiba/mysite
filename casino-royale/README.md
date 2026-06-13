# Casino Royale — カジノ練習サイト

マカオ・マニラのカジノゲームを無料で練習できるWebサイトです。

## ゲーム一覧

| ゲーム | ファイル | 特徴 |
|--------|----------|------|
| バカラ | baccarat.html | 第3カードルール完全実装・結果履歴 |
| ブラックジャック | blackjack.html | Hit/Stand/Double・戦略ヒント付き |
| ルーレット | roulette.html | キャンバスアニメーションホイール |
| シックボー（大小） | sicbo.html | 大小/トリプル/合計ベット |
| ドラゴンタイガー | dragontiger.html | スートベット・履歴トラック |

## GitHub Pages での公開方法

1. GitHubで新しいリポジトリを作成
2. このフォルダの内容をpush
3. Settings → Pages → Source: main branch / root
4. `https://[username].github.io/[repo-name]/` でアクセス可能

## ローカルで確認

```bash
# Python 3 で簡易サーバー起動
cd mysite
python3 -m http.server 8080
# → http://localhost:8080 でアクセス
```

## 技術スタック

- HTML5 / CSS3 / Vanilla JavaScript
- Google Fonts (Cinzel + Lato)
- Canvas API (ルーレットホイール)
- localStorage (残高の保存)
- 外部依存ゼロ → GitHub Pages で即公開可能
