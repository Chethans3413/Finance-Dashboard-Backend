import AuthGate from './components/AuthGate'
import AppShell from './AppShell'

export default function App() {
  return <AuthGate>{(token) => <AppShell token={token} />}</AuthGate>
}
