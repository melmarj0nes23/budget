import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/style.css';
import './styles/responsive.css';
import './styles/accessibility.css';
import './styles/footer.css';
import './styles/transparency-v2.css';
import './styles/legislative.css';
import './styles/statistics.css';
import './styles/legal.css';
import './index.css';
import './styles/fellowship-theme.css';
import './styles/bettergov-overrides.css';
import App from './App.tsx';

registerSW({
  onNeedRefresh() {
    // Avoid force-reloading the page during initial load; new SW activates on next visit.
  },
});

createRoot(document.getElementById('root')!).render(<App />);
