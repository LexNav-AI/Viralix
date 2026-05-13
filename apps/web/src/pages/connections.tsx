import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ExternalLink, Unlink, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

const PLATFORM_INFO = [
  { id: 'instagram', name: 'Instagram', color: '#E1306C', bg: 'from-purple-600 to-pink-500', desc: 'Stories, Reels, Feed posts' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', bg: 'from-blue-600 to-blue-500', desc: 'Feed, Stories, Marketplace ads' },
  { id: 'tiktok', name: 'TikTok', color: '#FF0050', bg: 'from-gray-900 to-gray-800', desc: 'Short-form video ads' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', bg: 'from-blue-700 to-blue-600', desc: 'Professional audience ads' },
  { id: 'twitter', name: 'Twitter / X', color: '#1DA1F2', bg: 'from-sky-600 to-sky-500', desc: 'Promoted posts and campaigns' },
]

export default function ConnectionsPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections', wid],
    queryFn: () => api.connections.list(wid),
    enabled: !!wid,
  })

  const connectMutation = useMutation({
    mutationFn: (platform: string) => api.connections.getOAuthUrl(wid, platform).then(({ url }: { url: string }) => { window.location.href = url }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.connections.disconnect(wid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections', wid] }),
  })

  const refreshMutation = useMutation({
    mutationFn: (id: string) => api.connections.refresh(wid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections', wid] }),
  })

  const connMap = new Map(
    (connections ?? []).map((c: { platform: string; id: string; isActive: boolean; accountName: string; accountAvatarUrl?: string; tokenExpiresAt?: string }) => [c.platform, c])
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Platform Connections</h1>
        <p className="text-muted-foreground text-sm">Connect your social accounts to enable publishing</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {PLATFORM_INFO.map((platform, i) => {
            const conn = connMap.get(platform.id)
            const isConnected = conn?.isActive

            return (
              <motion.div key={platform.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card className={isConnected ? 'border-emerald-500/30 bg-emerald-500/5' : ''}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.bg} flex items-center justify-center shrink-0`}>
                      <span className="text-white font-bold text-lg">{platform.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{platform.name}</h3>
                        {isConnected
                          ? <Badge variant="success" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
                          : <Badge variant="outline" className="text-xs"><XCircle className="w-3 h-3 mr-1" />Not connected</Badge>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{platform.desc}</p>
                      {conn?.accountName && (
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={conn.accountAvatarUrl} />
                            <AvatarFallback className="text-xs">{conn.accountName[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{conn.accountName}</span>
                          {conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) < new Date(Date.now() + 7 * 86400000) && (
                            <Badge variant="warning" className="text-xs">Token expiring soon</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isConnected ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate(conn.id)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => disconnectMutation.mutate(conn.id)}>
                            <Unlink className="w-4 h-4 mr-1.5" />Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => connectMutation.mutate(platform.id)} loading={connectMutation.isPending}>
                          <ExternalLink className="w-4 h-4 mr-1.5" />Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How platform publishing works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• Viralix uses each platform&apos;s official API to publish on your behalf</p>
          <p>• Your credentials are encrypted and stored securely — never shared</p>
          <p>• You can revoke access at any time from your platform&apos;s app settings</p>
          <p>• Tokens are automatically refreshed before expiry to keep connections active</p>
        </CardContent>
      </Card>
    </div>
  )
}
