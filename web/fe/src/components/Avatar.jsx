const COLORS = [
  'bg-[#07c160]',
  'bg-[#4a90d9]',
  'bg-[#f2994a]',
  'bg-[#9b51e0]',
  'bg-[#eb5757]',
  'bg-[#2d9cdb]',
  'bg-[#27ae60]',
  'bg-[#bb6bd9]',
]

// 机器人不做特殊标识，仅在名字后加一朵小红花
export const displayName = (name, role) =>
  role === 'robot' ? `${name} 🌸` : name

export function Avatar({ user, size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-9 w-9 text-sm rounded-md',
    md: 'h-11 w-11 text-base rounded-md',
    lg: 'h-12 w-12 text-lg rounded-lg',
  }
  const color = COLORS[(user?.id ?? 0) % COLORS.length]
  const name = user?.username || '?'
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-medium text-white ${sizes[size]} ${color} ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
