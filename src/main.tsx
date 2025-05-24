import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HashRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './lib/wagmiConfig';
import { ThemeProvider } from "./components/theme-provider"; // Import ThemeProvider
import { Toaster } from "@/components/ui/sonner";
import FrameSDK from '@farcaster/frame-sdk';


function FarcasterFrameProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
  const init = async () => {
      FrameSDK.actions.ready();
    };

    init();
  }, []);

  return <>{children}</>;
 }

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
              <FarcasterFrameProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme"> {/* Wrap with ThemeProvider */}
            <App />
            <Toaster />
          </ThemeProvider>
              </FarcasterFrameProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HashRouter>
  </React.StrictMode>,
);

