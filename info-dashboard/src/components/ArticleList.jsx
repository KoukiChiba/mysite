import { useState } from 'react'

const INITIAL_COUNT = 10

const badgeColor = {
  blue:   'bg-blue-100 text-blue-700',
  pink:   'bg-pink-100 text-pink-700',
  violet: 'bg-violet-100 text-violet-700',
}

const buttonColor = {
  blue:   'bg-blue-500 hover:bg-blue-600',
  pink:   'bg-pink-500 hover:bg-pink-600',
  violet: 'bg-violet-500 hover:bg-violet-600',
}

/** "2026/03/31 9:15" などを Date に変換（パース失敗時は 0） */
function parseDate(str) {
  if (!str) return 0
  // "2026/03/31 9:15" → "2026-03-31T09:15"
  const normalized = str.trim().replace(/\//g, '-').replace(' ', 'T')
  const d = new Date(normalized)
  return isNaN(d) ? 0 : d.getTime()
}

function ArticleCard({ row, columns, color }) {
  const title     = row[columns.title]     ?? ''
  const url       = row[columns.url]       ?? '#'
  const published = row[columns.published] ?? ''
  const keyword   = columns.keyword != null ? row[columns.keyword] : null

  if (!title) return null

  return (
    <li className="group border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors leading-snug line-clamp-3">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {published && (
            <span className="text-xs text-gray-400">{published}</span>
          )}
          {keyword && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor[color]}`}>
              {keyword}
            </span>
          )}
        </div>
      </a>
    </li>
  )
}

export default function ArticleList({ articles, columns, color }) {
  const [showAll, setShowAll] = useState(false)

  if (articles.length === 0) {
    return <p className="text-center text-gray-400 py-10">記事がありません</p>
  }

  // 公開日時で降順ソート（新しい順）
  const sorted = [...articles]
    .filter(r => r[columns.title]?.trim())
    .sort((a, b) => parseDate(b[columns.published]) - parseDate(a[columns.published]))

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_COUNT)
  const remaining = sorted.length - INITIAL_COUNT

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((row, i) => (
          <ArticleCard key={i} row={row} columns={columns} color={color} />
        ))}
      </ul>

      {!showAll && remaining > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className={`${buttonColor[color]} text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors`}
          >
            もっとみる（残り {remaining} 件）
          </button>
        </div>
      )}

      {showAll && sorted.length > INITIAL_COUNT && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(false)}
            className="text-gray-400 hover:text-gray-600 text-sm underline"
          >
            折りたたむ
          </button>
        </div>
      )}
    </div>
  )
}
