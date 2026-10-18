import { Link } from '@tanstack/react-router'
import type { NotFoundRouteProps } from '@tanstack/react-router'
import { FileQuestion, Home } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from 'cn'

export function NotFound(_props?: NotFoundRouteProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-xs">
        <FileQuestion className="size-7 stroke-[1.5]" />
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        404 - Halaman Tidak Ditemukan
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Halaman yang Anda tuju tidak ditemukan atau telah dipindahkan.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          to="/"
          className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}
        >
          <Home className="size-4" />
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}
