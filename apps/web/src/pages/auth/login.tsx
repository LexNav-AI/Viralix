import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'wouter'
import { Zap, Mail, Lock } from 'lucide-react'
import { useLogin } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const onSubmit = (data: FormData) => login.mutate(data)

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[hsl(262,83%,58%,0.05)] blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] shadow-xl shadow-[hsl(262,83%,58%,0.35)] mb-4 animate-pulse-glow">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Viralix</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">AI-powered marketing automation</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input type="email" placeholder="you@company.com" className="pl-9" {...register('email')} />
                </div>
                {errors.email && <p className="text-xs text-[hsl(var(--destructive))] mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Password</Label>
                  <a href="#" className="text-xs text-[hsl(var(--accent-foreground))] hover:underline">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input type="password" placeholder="••••••••" className="pl-9" {...register('password')} />
                </div>
                {errors.password && <p className="text-xs text-[hsl(var(--destructive))] mt-1">{errors.password.message}</p>}
              </div>
              {login.error && (
                <div className="rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] px-3 py-2">
                  <p className="text-xs text-[hsl(var(--destructive))]">Invalid email or password</p>
                </div>
              )}
              <Button type="submit" className="w-full" size="lg" loading={login.isPending}>Sign in</Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[hsl(var(--accent-foreground))] hover:underline font-medium">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
