import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import PresaleListPage from "./pages/PresaleListPage";
import PresaleDetailPage from "./pages/PresaleDetailPage";
import CreatePresalePage from "./pages/CreatePresalePage";
import UserProfilePage from "./pages/UserProfilePage";
import NotFoundPage from "./pages/NotFoundPage";

// Import the Farcaster SDK
import { sdk } from "@farcaster/frame-sdk";

// Import Sonner Toaster
import { Toaster } from "@/components/ui/sonner"; // Import Sonner Toaster

// Import ErrorBoundary
import ErrorBoundary from "./components/ErrorBoundary"; // Import ErrorBoundary

function App() {
  useEffect(() => {
    const initFarcaster = async () => {
      // Call ready() when the App component mounts and is ready
      await sdk.actions.ready();
    };

    // Check if running in a Mini App environment before calling ready
    // This is optional but good practice if your app can also run outside Farcaster
    sdk.isInMiniApp().then((isMiniApp) => {
      if (isMiniApp) {
        initFarcaster();
      }
    });

    // No cleanup needed for this effect
  }, []); // Empty dependency array means this runs once on mount

  return (
    <Layout>
      <ErrorBoundary>
        {" "}
        {/* Wrap top-level routes or specific problematic routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/presales" element={<PresaleListPage />} />
          <Route path="/presale/:address" element={<PresaleDetailPage />} />
          {/* Wrap the specific route causing issues */}
          <Route
            path="/create"
            element={
              <ErrorBoundary>
                <CreatePresalePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/profile"
            element={
              <ErrorBoundary>
                <UserProfilePage />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
      <Toaster richColors /> {/* Keep Toaster here */}
    </Layout>
  );
}

export default App;
