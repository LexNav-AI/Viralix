import { Switch, Route } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/sidebar'
import Dashboard from './pages/dashboard'
import Campaigns from './pages/campaigns'
import CampaignDetail from './pages/campaign-detail'
import AdLibrary from './pages/ad-library'
import Schedule from './pages/schedule'
import Analytics from './pages/analytics'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen overflow-hidden bg-[#09090B]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/campaigns" component={Campaigns} />
            <Route path="/campaigns/:id" component={CampaignDetail} />
            <Route path="/ads" component={AdLibrary} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/analytics" component={Analytics} />
          </Switch>
        </main>
      </div>
    </QueryClientProvider>
  )
}
