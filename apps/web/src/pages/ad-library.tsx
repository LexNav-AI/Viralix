import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search, Filter, Grid, List, Archive, Download, Send } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import AdCard from '@/components/ads/ad-card'

const FORMATS = ['all', 'static_image', 'story', 'video', 'reel', 'carousel', 'banner_300x250', 'banner_728x90']
const PLATFORMS = ['all', 'facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'universal']
const STATUSES = ['all', 'ready', 'generating', 'published', 'archived', 'failed']

export default function AdLibraryPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['ads', wid, { format, platform, status, page }],
    queryFn: () => api.ads.list(wid, {
      format: format === 'all' ? undefined : format,
      platform: platform === 'all' ? undefined : platform,
      status: status === 'all' ? undefined : status,
      page,
      limit: 24,
    }),
    enabled: !!wid,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.ads.archive(wid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ads', wid] }); setSelected(new Set()) },
  })

  const filtered = (data?.data ?? []).filter((ad: { headline: string }) =>
    !search || ad.headline.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const bulkArchive = () => {
    selected.forEach(id => archiveMutation.mutate(id))
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Library</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} ads total</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Badge variant="secondary">{selected.size} selected</Badge>
              <Button size="sm" variant="outline" onClick={bulkArchive}>
                <Archive className="w-4 h-4 mr-1.5" />Archive
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
            {view === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-48" placeholder="Search ads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map(f => <SelectItem key={f} value={f}>{f === 'all' ? 'All formats' : f.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All platforms' : p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3' : 'space-y-2'}>
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No ads match your filters.</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3' : 'space-y-2'}>
          {filtered.map((ad: { id: string; headline: string; format: string; platform: string; status: string; thumbnailUrl?: string }, i: number) => (
            <motion.div key={ad.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <AdCard
                ad={ad}
                selected={selected.has(ad.id)}
                onSelect={() => toggleSelect(ad.id)}
                workspaceId={wid}
                view={view}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 24 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 24)}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / 24)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
