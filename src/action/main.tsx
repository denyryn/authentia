import {createRoot} from 'react-dom/client'

import {env} from '@/lib/chrome-env'

import {PopupApp} from './PopupApp'
import '../styles/globals.css'

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(<PopupApp env={env} />)
}
