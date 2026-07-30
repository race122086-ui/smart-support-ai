import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '../components/ui/ErrorBoundary.jsx'
import { ToastProvider } from '../components/ui/Feedback.jsx'
import { queryClient } from './query-client.js'
import { router } from './router.jsx'

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
