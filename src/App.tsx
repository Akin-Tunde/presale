import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import PresaleListPage from './pages/PresaleListPage';
import PresaleDetailPage from './pages/PresaleDetailPage';
import CreatePresalePage from './pages/CreatePresalePage';
import UserProfilePage from './pages/UserProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from "@/components/ui/sonner"; // Import Sonner Toaster
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary

function App() {
  return (
    <Layout>
      <ErrorBoundary> {/* Wrap top-level routes or specific problematic routes */}
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
      <Toaster richColors /> {/* Add Toaster here */}
    </Layout>
  );
}

export default App;

