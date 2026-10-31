import {createRoot} from 'react-dom/client'

import {env} from '@/lib/chrome-env'
import {OptionsApp} from './OptionsApp'
import '../styles/globals.css'

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(<OptionsApp env={env} />)
}
