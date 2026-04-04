/**
 * 簡易 CSV パーサー
 * RFC 4180 の基本的なケース（ダブルクォート囲み・改行含むフィールド）に対応
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuote) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\r' && next === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
      } else if (ch === '\n' || ch === '\r') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
      } else {
        field += ch
      }
    }
  }

  // 最後のフィールド/行
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** rows[0] をヘッダーとして除去し、空行もスキップする */
export function csvToObjects(rows) {
  const [, ...data] = rows
  return data.filter(r => r.some(c => c.trim() !== ''))
}
