import { createRoot } from 'react-dom/client'
import 'virtual:morpheus-node-styles'
import App from './App.jsx'

// StrictMode intentionally NOT enabled. Morpheus is not React 18 StrictMode-safe:
// its createNode flow reserves a pending-instance slot before the kernel finishes
// initialization, and StrictMode's double-invoke of useEffect triggers duplicate-
// instance + orphan-parent errors plus a destroyed-kernel reference in the DevApp
// trigger. Matches the web app's pattern (some-morpheus-based-app/src/main.jsx).
createRoot(document.getElementById('root')).render(<App />)
