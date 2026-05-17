import { Link, useLocation } from 'wouter'
import { LayoutDashboard, Megaphone, Image, Calendar, BarChart3, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { href: '/ads', icon: Image, label: 'Ad Library' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export function Sidebar() {
  const [location] = useLocation()

  return (
    <aside className="w-56 shrink-0 bg-[#111116] border-r border-[#1A1A24] flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-[#1A1A24]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#F4F4F5] tracking-tight">Viralix</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== '/' && location.startsWith(href))
          return (
            <Link key={href} href={href}>
              <a className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-[#1A1033] text-[#A78BFA]'
                  : 'text-[#8B8BA0] hover:text-[#F4F4F5] hover:bg-[#1A1A24]'
              )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </a>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-[#1A1A24]">
        <div className="px-3 py-2 text-xs text-[#8B8BA0]">
          14 ads/day per campaign
        </div>
      </div>
    </aside>
  )
}
