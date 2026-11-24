import { createRoot } from 'react-dom/client';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/style.css';
import './styles/responsive.css';
import './styles/accessibility.css';
import './styles/footer.css';
import './styles/transparency-v2.css';
import './index.css';
import './styles/fellowship-theme.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
