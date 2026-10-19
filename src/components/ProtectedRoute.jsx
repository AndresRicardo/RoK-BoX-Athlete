import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import PageLoader from './PageLoader';

export default function ProtectedRoute({ children }) {
  const { session, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <PageLoader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
