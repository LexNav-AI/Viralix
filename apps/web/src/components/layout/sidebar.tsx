import { Link, useLocation } from 'wouter'
import {
  LayoutDashboard,
  Megaphone,
  Image,
  Wand2,
  Calendar,
  Link2,
  BarChart3,
  FlaskConical,
  Mic2,
  Settings,
  Zap,
  ChevronDown,
  Plus,
  Check,
} from 'lucide-react'
import { cn, getInitials } from '../../lib/utils'
import { useAuth } from '../../lib/hooks/use-auth'
import { useWorkspace } from '../../lib/hooks/use-workspace'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, href: '/dashboard' },
      { label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />, href: '/campaigns' },
      { label: 'Ad Library', icon: <Image className="h-4 w-4" />, href: '/ads' },
      { label: 'Generate Ads', icon: <Wand2 className="h-4 w-4" />, href: '/generate' },
    ],
  },
  {
    title: 'Publishing',
    items: [
      { label: 'Content Calendar', icon: <Calendar className="h-4 w-4" />, href: '/calendar' },
      { label: 'Connections', icon: <Link2 className="h-4 w-4" />, href: '/connections' },
    ],
  },
  {
    title: 'Optimize',
    items: [
      { label: 'Analytics', icon: <BarChart3 className="h-4 w-4" />, href: '/analytics' },
      { label: 'A/B Testing', icon: <FlaskConical className="h-4 w-4" />, href: '/ab-testing' },
    ],
  },
  {
    title: 'Brand',
    items: [
      { label: 'Brand Voice', icon: <Mic2 className="h-4 w-4" />, href: '/brand-voice' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', icon: <Settings className="h-4 w-4" />, href: '/settings' },
    ],
  },
]

export function Sidebar() {
  const [location] = useLocation()
  const { user, logout } = useAuth()
  const { workspace, workspaceList, setWorkspace } = useWorkspace()

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col"
      style={{ width: 'var(--sidebar-width)', background: 'hsl(240 5% 6%)', borderRight: '1px solid hsl(var(--border))' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[hsl(var(--border))]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] shadow-lg shadow-[hsl(262,83%,58%,0.3)]">
          <Zap className="h-4.5 w-4.5 text-white fill-white" style={{ height: '18px', width: '18px' }} />
        </div>
        <span className="text-base font-bold tracking-tight text-[hsl(var(--foreground))]">Viralix</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'sidebar-link',
                        isActive && 'active',
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Workspace switcher */}
      <div className="border-t border-[hsl(var(--border))] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[hsl(var(--accent))] transition-colors text-left">
              <div className="h-6 w-6 rounded bg-[hsl(var(--primary)/0.2)] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[hsl(var(--accent-foreground))]">
                  {workspace?.name?.[0]?.toUpperCase() ?? 'W'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                  {workspace?.name ?? 'Workspace'}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                  {workspace?.industry ?? 'Marketing'}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" side="top">
            {workspaceList.map((ws) => (
              <DropdownMenuItem key={ws.id} onClick={() => setWorkspace(ws)}>
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-5 w-5 rounded bg-[hsl(var(--accent))] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[hsl(var(--accent-foreground))]">
                      {ws.name[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="truncate">{ws.name}</span>
                </div>
                {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 ml-auto text-[hsl(var(--primary))]" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Plus className="h-4 w-4" />
              New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1 hover:bg-[hsl(var(--accent))] transition-colors text-left">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                  {user?.name ?? 'User'}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                  {user?.email ?? ''}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
