import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

function PublicRoute({ children }) {
  const { user, loading, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (user) {
    const from = location.state?.from?.pathname || '/community';
    return <Navigate to={from} replace />;
  }

  return children;
}

export default PublicRoute;
