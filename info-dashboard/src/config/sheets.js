// Google スプレッドシートの設定
// 各シートは「リンクを知っている全員が閲覧可能」に設定してください

const csvUrl = (id, gid = 0) =>
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`

export const SHEETS = {
  travel: {
    label: '旅行セール',
    icon: '✈️',
    color: 'blue',
    articlesUrl: csvUrl('1-zw8BZ3j2KL2hF0VXCZeqRFWD3CnnFJXBzDdZChd_5s', 0),
    summaryUrl:  csvUrl('1-zw8BZ3j2KL2hF0VXCZeqRFWD3CnnFJXBzDdZChd_5s', 849086669),
    columns: { date: 0, title: 1, url: 2, published: 3, keyword: 4 },
  },
  nmixx: {
    label: 'NMIXXニュース',
    icon: '🎵',
    color: 'pink',
    articlesUrl: csvUrl('1uLq6ulND2clwhoKcr__VuKCGhlZXSruaYNDjRaX-8WA', 0),
    summaryUrl: null,
    columns: { date: 0, title: 1, url: 2, published: 3 },
  },
  ai: {
    label: 'AIニュース',
    icon: '🤖',
    color: 'violet',
    articlesUrl: csvUrl('15ZyGnTwXYMyiZPt9EaOY5c_p86HVa512_ba9hWIjJ-E', 0),
    summaryUrl:  csvUrl('15ZyGnTwXYMyiZPt9EaOY5c_p86HVa512_ba9hWIjJ-E', 849086669),
    columns: { date: 0, title: 1, url: 2, published: 3, keyword: 4 },
  },
}

export const TAB_KEYS = ['travel', 'nmixx', 'ai']
