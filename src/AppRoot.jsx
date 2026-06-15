import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import useAuthStore from './stores/authStore';

function AppRoot() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <RouterProvider router={router} />;
}

export default AppRoot;
