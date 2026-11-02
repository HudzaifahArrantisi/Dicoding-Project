import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import { QueryClientProvider } from '@tanstack/react-query'

import { NotFound } from '../components/not-found'
import { AuthProvider } from '../lib/auth'
import { Toaster } from '../components/ui/sonner'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Daisuki Inventory - B2B Inventory Management',
      },
      {
        name: 'theme-color',
        content: '#141b3d',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/jpeg',
        href: '/icons/logo.jpg',
      },
      {
        rel: 'shortcut icon',
        type: 'image/jpeg',
        href: '/icons/logo.jpg',
      },
      {
        rel: 'apple-touch-icon',
        href: '/icons/logo.jpg',
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" type="image/jpeg" href="/icons/logo.jpg" />
        <link rel="shortcut icon" type="image/jpeg" href="/icons/logo.jpg" />
        <link rel="apple-touch-icon" href="/icons/logo.jpg" />
        <script src="/pwa.js" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
