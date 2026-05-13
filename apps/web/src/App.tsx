import { Switch, Route, Redirect } from 'wouter'
import { WorkspaceProvider } from './lib/workspace-context'
import { isAuthenticated } from './lib/auth'
import AppShell from './components/layout/app-shell'
import LoginPage from './pages/auth/login'
import RegisterPage from './pages/auth/register'
import DashboardPage from './pages/dashboard'
import CampaignsPage from './pages/campaigns/index'
import NewCampaignPage from './pages/campaigns/new'
import CampaignDetailPage from './pages/campaigns/detail'
import AdLibraryPage from './pages/ad-library'
import AdGeneratorPage from './pages/ad-generator'
import ContentCalendarPage from './pages/content-calendar'
import AnalyticsPage from './pages/analytics'
import BrandVoicePage from './pages/brand-voice'
import ConnectionsPage from './pages/connections'
import AbTestingPage from './pages/ab-testing'
import SettingsPage from './pages/settings'

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Redirect to="/login" />
  return <>{children}</>
}

export default function App() {
  return (
    <WorkspaceProvider>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route>
          <AuthGuard>
            <AppShell>
              <Switch>
                <Route path="/">
                  <Redirect to="/dashboard" />
                </Route>
                <Route path="/dashboard" component={DashboardPage} />
                <Route path="/campaigns" component={CampaignsPage} />
                <Route path="/campaigns/new" component={NewCampaignPage} />
                <Route path="/campaigns/:id" component={CampaignDetailPage} />
                <Route path="/ads" component={AdLibraryPage} />
                <Route path="/generate" component={AdGeneratorPage} />
                <Route path="/calendar" component={ContentCalendarPage} />
                <Route path="/analytics" component={AnalyticsPage} />
                <Route path="/brand-voice" component={BrandVoicePage} />
                <Route path="/connections" component={ConnectionsPage} />
                <Route path="/ab-testing" component={AbTestingPage} />
                <Route path="/settings" component={SettingsPage} />
              </Switch>
            </AppShell>
          </AuthGuard>
        </Route>
      </Switch>
    </WorkspaceProvider>
  )
}
