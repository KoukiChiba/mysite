import { SHEETS, TAB_KEYS } from '../config/sheets'

const colorActive = {
  blue:   'border-blue-500 text-blue-600 bg-blue-50',
  pink:   'border-pink-500 text-pink-600 bg-pink-50',
  violet: 'border-violet-500 text-violet-600 bg-violet-50',
}
const colorHover = {
  blue:   'hover:border-blue-300 hover:text-blue-500',
  pink:   'hover:border-pink-300 hover:text-pink-500',
  violet: 'hover:border-violet-300 hover:text-violet-500',
}

export default function TabNav({ active, onChange }) {
  return (
    <nav className="flex border-b border-gray-200 overflow-x-auto">
      {TAB_KEYS.map(key => {
        const { label, icon, color } = SHEETS[key]
        const isActive = active === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={[
              'flex-1 min-w-max px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              isActive
                ? colorActive[color]
                : `border-transparent text-gray-500 ${colorHover[color]}`,
            ].join(' ')}
          >
            <span className="mr-1">{icon}</span>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
