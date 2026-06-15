import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import useAuthStore from './stores/authStore';
import useProfileStore from './stores/profileStore';
import usePRStore from './stores/prStore';
import useBenchmarkStore from './stores/benchmarkStore';

function AppRoot() {
  const initialize = useAuthStore((s) => s.initialize);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!userId) {
      useProfileStore.getState().reset();
      usePRStore.getState().reset();
      useBenchmarkStore.getState().reset();
    }
  }, [userId]);

  return <RouterProvider router={router} />;
}

export default AppRoot;
