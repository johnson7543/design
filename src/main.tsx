import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/design-tokens.css'
import 'designqr/style.css'
import './index.css'
import './platform.css'
import { DesignPlatform } from './platform/DesignPlatform.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignPlatform />
  </StrictMode>,
)
