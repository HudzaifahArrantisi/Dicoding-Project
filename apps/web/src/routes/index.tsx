import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { OnboardingWalkthrough } from '@/components/onboarding-walkthrough'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { tour?: boolean } => ({ tour: search.tour === true || search.tour === 'true' }),
  component: Home,
})

function Home() {
  const { user, isLoading } = useAuth()
  const { tour } = Route.useSearch()
  const navigate = useNavigate()
  const [seen, setSeen] = useState<boolean | null>(null)
  useEffect(() => {
    try { setSeen(localStorage.getItem('daisuki_intro_seen') === 'true') }
    catch { setSeen(false) }
  }, [])
  if (isLoading || seen === null) return <main className="grid min-h-dvh place-items-center bg-paper text-muted" role="status">Memuat panduan...</main>
  if (!tour && user) return <Navigate to={user.role === 'admin' ? '/admin' : '/mitra'} replace />
  if (!tour && seen) return <Navigate to="/login" replace />
  return <OnboardingWalkthrough onFinish={() => {
    try { localStorage.setItem('daisuki_intro_seen', 'true') } catch { /* Penyimpanan dapat diblokir browser; navigasi tetap berjalan. */ }
    void navigate({ to: '/login', replace: true })
  }} />
}
