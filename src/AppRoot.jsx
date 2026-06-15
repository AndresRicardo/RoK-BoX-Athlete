import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import useAuthStore from './stores/authStore';
import useProfileStore from './stores/profileStore';
import usePRStore from './stores/prStore';
import useBenchmarkStore from './stores/benchmarkStore';
import useAchievementStore from './stores/achievementStore';
import useMovementStore from './stores/movementStore';
import AchievementModal from './components/AchievementModal';

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
      useAchievementStore.getState().reset();
      useMovementStore.getState().reset();
    }
  }, [userId]);

  return (
    <>
      <RouterProvider router={router} />
      <AchievementModal />
    </>
  );
}

export default AppRoot;
