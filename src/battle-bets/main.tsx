import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

// Register GSAP plugins
gsap.registerPlugin(MotionPathPlugin)

// Note: StrictMode disabled temporarily to avoid PixiJS double-initialization issues
createRoot(document.getElementById('root')!).render(
  <App />
)
