import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import PresaleListPage from "./pages/PresaleListPage";
import PresaleDetailPage from "./pages/PresaleDetailPage";
import CreatePresalePage from "./pages/CreatePresalePage";
import UserProfilePage from "./pages/UserProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import { sdk } from "@farcaster/frame-sdk";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { signIn, promptAddFrameAndNotifications, AuthUser } from "./utils/auth";
import { useAccount } from "wagmi";

const App: React.FC = () => {
  const [, setUser] = useState<AuthUser | null>(null);
  const [, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address: connectedAddress } = useAccount();

  useEffect(() => {
    const initializeMiniApp = async () => {
      try {
        await sdk.actions.ready();

        const userAddressForAuth = connectedAddress || "";

        const authUser = await signIn(userAddressForAuth);
        if (authUser) {
          setUser(authUser);
          if (userAddressForAuth) {
            const result = await promptAddFrameAndNotifications(
              userAddressForAuth
            );
            if (result.added) {
              setUser((prevUser) =>
                prevUser ? { ...prevUser, hasAddedApp: true } : null
              );
            }
          }
        }
      } catch (error) {
        console.error("Error initializing app:", error);
        setError("Failed to initialize app. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    initializeMiniApp();
  }, [connectedAddress]);

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-900 text-white justify-center items-center">
        {error}
      </div>
    );
  }
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
};

export default App;
