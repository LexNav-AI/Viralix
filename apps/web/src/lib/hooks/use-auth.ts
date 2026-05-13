import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import type { LoginRequest, RegisterRequest, User } from '@viralix/types'
import { auth } from '../api'
import { getToken, getUser, setToken, setUser, clearAuth, isAuthenticated } from '../auth'

// Standalone mutation hooks for backward compat
export function useLogin() {
  const queryClient = useQueryClient()
  const [, navigate] = useLocation()
  return useMutation({
    mutationFn: (data: LoginRequest) => auth.login(data),
    onSuccess: (res) => {
      setToken(res.token)
      setUser(res.user)
      queryClient.setQueryData(['auth', 'me'], res.user)
      navigate('/dashboard')
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  const [, navigate] = useLocation()
  return useMutation({
    mutationFn: (data: RegisterRequest) => auth.register(data),
    onSuccess: (res) => {
      setToken(res.token)
      setUser(res.user)
      queryClient.setQueryData(['auth', 'me'], res.user)
      navigate('/dashboard')
    },
  })
}

export function useAuth() {
  const queryClient = useQueryClient()
  const [, navigate] = useLocation()

  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => auth.me(),
    enabled: isAuthenticated(),
    initialData: getUser() ?? undefined,
    staleTime: 5 * 60_000,
  })

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => auth.login(data),
    onSuccess: (res) => {
      setToken(res.token)
      setUser(res.user)
      queryClient.setQueryData(['auth', 'me'], res.user)
      navigate('/dashboard')
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => auth.register(data),
    onSuccess: (res) => {
      setToken(res.token)
      setUser(res.user)
      queryClient.setQueryData(['auth', 'me'], res.user)
      navigate('/dashboard')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login')
    },
  })

  return {
    user: currentUser as User | undefined,
    isLoadingUser,
    isAuthenticated: isAuthenticated(),
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  }
}
