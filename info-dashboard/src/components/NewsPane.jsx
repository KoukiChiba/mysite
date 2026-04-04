import { useSheetData } from '../hooks/useSheetData'
import SummaryCard from './SummaryCard'
import ArticleList from './ArticleList'

export default function NewsPane({ config }) {
  const { articles, summary, loading, error } = useSheetData(
    config.articlesUrl,
    config.summaryUrl,
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm">データを読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-700">
        <p className="font-semibold mb-1">読み込みエラー</p>
        <p className="text-xs font-mono">{error}</p>
        <p className="mt-3 text-xs text-red-500">
          スプレッドシートの共有設定を「リンクを知っている全員が閲覧可能」にしてください。
        </p>
      </div>
    )
  }

  return (
    <div>
      <SummaryCard text={summary} color={config.color} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{articles.length} 件</p>
      </div>
      <ArticleList articles={articles} columns={config.columns} color={config.color} />
    </div>
  )
}
