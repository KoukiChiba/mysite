const colorBg = {
  blue:   'bg-blue-50 border-blue-200 text-blue-900',
  pink:   'bg-pink-50 border-pink-200 text-pink-900',
  violet: 'bg-violet-50 border-violet-200 text-violet-900',
}

export default function SummaryCard({ text, color }) {
  if (!text) return null
  return (
    <div className={`rounded-xl border p-4 mb-5 text-sm leading-relaxed whitespace-pre-wrap ${colorBg[color]}`}>
      <p className="font-semibold mb-1 text-xs uppercase tracking-wide opacity-60">トピックまとめ</p>
      {text}
    </div>
  )
}
