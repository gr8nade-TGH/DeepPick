import { createRoot } from 'react-dom/client'
import './index.css'
import AppV2 from './AppV2.tsx'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

// Register GSAP plugins
gsap.registerPlugin(MotionPathPlugin)

// Ensure GSAP ticker is running and connected to browser RAF
// This fixes issues where GSAP's internal ticker might not start in some bundler contexts
console.log('🎬 [GSAP Init] Setting up GSAP ticker...');
console.log('🎬 [GSAP Init] Ticker time before:', gsap.ticker.time);

// Force GSAP ticker to use requestAnimationFrame
gsap.ticker.fps(-1); // -1 = use requestAnimationFrame (max fps)
gsap.ticker.lagSmoothing(0); // Disable lag smoothing for consistent animation

// Add a persistent listener to ensure ticker keeps running
gsap.ticker.add(() => {
  // This empty callback ensures the ticker stays active
});

// Log ticker state after setup
setTimeout(() => {
  console.log('🎬 [GSAP Init] Ticker time after 100ms:', gsap.ticker.time);
  console.log('🎬 [GSAP Init] Global timeline paused:', gsap.globalTimeline.paused());
  console.log('🎬 [GSAP Init] Global timeline children:', gsap.globalTimeline.getChildren().length);
}, 100);

// Note: StrictMode disabled temporarily to avoid PixiJS double-initialization issues
createRoot(document.getElementById('root')!).render(
  <AppV2 />
)

