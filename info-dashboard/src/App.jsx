import { useState } from 'react'
import TabNav from './components/TabNav'
import NewsPane from './components/NewsPane'
import { SHEETS, TAB_KEYS } from './config/sheets'

export default function App() {
  const [activeTab, setActiveTab] = useState(TAB_KEYS[0])
  const config = SHEETS[activeTab]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 py-3">
            <span className="text-xl">📊</span>
            <h1 className="text-base font-bold text-gray-800 tracking-tight">Info Dashboard</h1>
          </div>
          <TabNav active={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{config.icon}</span>
          <h2 className="text-lg font-semibold text-gray-700">{config.label}</h2>
        </div>
        <NewsPane key={activeTab} config={config} />
      </main>

      {/* フッター */}
      <footer className="text-center text-xs text-gray-300 py-8">
        データソース: Google Sheets &nbsp;|&nbsp; 自動更新
      </footer>
    </div>
  )
}
