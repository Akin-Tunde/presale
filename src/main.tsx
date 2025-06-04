import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Import ThemeProvider
import { config } from "./lib/wagmiConfig";
import { ThemeProvider } from "./components/theme-provider";
// import { Toaster } from "@/components/ui/sonner"; // Toaster is now only in App.tsx
import { sdk as FrameSDK } from "@farcaster/frame-sdk"; // Changed import to named import 'sdk' and aliased

import { setupVestingLogging } from "./utils/vestingLogger";

// Initialize vesting logging
setupVestingLogging();

function FarcasterFrameProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const init = async () => {
      // Consider if this is the best place/time to call ready().
      // Farcaster docs recommend calling it when your UI is truly ready to avoid jitter.
      await FrameSDK.actions.ready(); // Use await and the imported sdk
    };
    init();
  }, []);

  return <>{children}</>;
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <FarcasterFrameProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
              {" "}
              {/* Wrap with ThemeProvider */}
              <App />{" "}
              {/* Toaster component removed from here, App.tsx has its own */}
            </ThemeProvider>
          </FarcasterFrameProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  </React.StrictMode>
);
