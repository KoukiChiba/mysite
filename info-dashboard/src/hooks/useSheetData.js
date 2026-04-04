import { useState, useEffect } from 'react'
import { parseCsv, csvToObjects } from '../utils/csvParser'

// 開発時: Vite dev server のプロキシ経由（CORS不要）
// 本番時: allorigins 公開プロキシ経由
function resolveUrl(url) {
  if (import.meta.env.DEV) {
    // https://docs.google.com/spreadsheets/... → /sheets-proxy/...
    return url.replace('https://docs.google.com/spreadsheets', '/sheets-proxy')
  }
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
}

async function fetchCsv(url) {
  const res = await fetch(resolveUrl(url))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return csvToObjects(parseCsv(text))
}

/**
 * @param {string|null} articlesUrl
 * @param {string|null} summaryUrl
 * @returns {{ articles, summary, loading, error }}
 */
export function useSheetData(articlesUrl, summaryUrl) {
  const [articles, setArticles] = useState([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!articlesUrl) return
    setLoading(true)
    setError(null)

    const promises = [fetchCsv(articlesUrl)]
    if (summaryUrl) promises.push(fetchCsv(summaryUrl))

    Promise.all(promises)
      .then(([articleRows, summaryRows]) => {
        setArticles(articleRows)
        if (summaryRows?.[0]?.[0]) setSummary(summaryRows[0][0])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [articlesUrl, summaryUrl])

  return { articles, summary, loading, error }
}
