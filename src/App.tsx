import { HashRouter } from 'react-router-dom'
import { AppProviders } from './providers'
import { AppRouter } from './router'

export default function App() {
  return (
    /**
     * HashRouter est NON-NÉGOCIABLE (D-09).
     * GitHub Pages ne peut pas rediriger les URLs profondes vers index.html.
     * BrowserRouter cause une 404 sur tout rafraîchissement de page.
     */
    <HashRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </HashRouter>
  )
}
