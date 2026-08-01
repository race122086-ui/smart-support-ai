import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '../components/ui/ErrorBoundary.jsx'
import { ToastProvider } from '../components/ui/Feedback.jsx'
import { queryClient } from './query-client.js'
import { SessionProvider } from './session.jsx'
import { router } from './router.jsx'

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
