import { BrowserRouter } from 'react-router-dom'
import { AppShell } from '@/app/layout/AppShell'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { AppRouter } from '@/app/router/AppRouter'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell>
          <AppRouter />
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  )
}
