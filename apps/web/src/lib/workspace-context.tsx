import { createContext, useState, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Workspace } from '@viralix/types'
import { workspaces } from './api'
import { isAuthenticated } from './auth'

const WORKSPACE_KEY = 'viralix_workspace_id'

interface WorkspaceContextValue {
  workspace: Workspace | null
  workspaceList: Workspace[]
  isLoading: boolean
  setWorkspace: (workspace: Workspace) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(WORKSPACE_KEY),
  )

  const { data: workspaceList = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaces.list(),
    enabled: isAuthenticated(),
  })

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (!currentWorkspaceId && workspaceList.length > 0) {
      const first = workspaceList[0]
      setCurrentWorkspaceId(first.id)
      localStorage.setItem(WORKSPACE_KEY, first.id)
    }
  }, [workspaceList, currentWorkspaceId])

  const workspace =
    workspaceList.find((w) => w.id === currentWorkspaceId) ?? workspaceList[0] ?? null

  const setWorkspace = (ws: Workspace) => {
    setCurrentWorkspaceId(ws.id)
    localStorage.setItem(WORKSPACE_KEY, ws.id)
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaceList, isLoading, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
