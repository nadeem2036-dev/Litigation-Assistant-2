import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Requirement 3: Automatically update installed apps when connected to internet if changes published
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New app version detected. Auto-updating installed application...');
    updateSW(true);
  },
  onRegistered(r) {
    if (r) {
      // Check for updates periodically when connected to internet
      setInterval(() => {
        if (navigator.onLine) {
          r.update().catch(() => {});
        }
      }, 45000);
    }
  },
});

createRoot(document.getElementById('root')!).render(<App />);
