import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CMSProvider } from './context/CMSContext';
import PlatformPreviewApp from './preview/PlatformPreviewApp';
import { installPreviewSafetyRuntime } from './preview/previewFixtures';
import './styles/global.css';

const isPlatformPreview = window.location.pathname === '/__platform-preview';
if (isPlatformPreview) installPreviewSafetyRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  isPlatformPreview ? (
    <React.StrictMode>
      <ThemeProvider>
        <PlatformPreviewApp />
      </ThemeProvider>
    </React.StrictMode>
  ) : (
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
        <AuthProvider>
          <CMSProvider>
            <App />
          </CMSProvider>
        </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
);
