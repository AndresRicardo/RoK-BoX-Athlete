import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import useAuthStore from './stores/authStore';
import useProfileStore from './stores/profileStore';
import usePRStore from './stores/prStore';
import useBenchmarkStore from './stores/benchmarkStore';
import useAchievementStore from './stores/achievementStore';
import useMovementStore from './stores/movementStore';
import useFollowStore from './stores/followStore';
import useFeedStore from './stores/feedStore';
import useEngagementStore from './stores/engagementStore';
import useNotificationStore from './stores/notificationStore';
import AchievementModal from './components/AchievementModal';

function AppRoot() {
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sincroniza la foto de Google a profiles (visible para otros atletas)
  useEffect(() => {
    if (userId) {
      const url =
        user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
      if (url) {
        useProfileStore.getState().syncAvatar(userId, url).catch(() => {});
      }
    }
  }, [userId, user]);

  // Suscribe a la campana de notificaciones en tiempo real
  useEffect(() => {
    if (userId) {
      useNotificationStore.getState().subscribeRealtime(userId);
    } else {
      useNotificationStore.getState().unsubscribe();
    }
    return () => {
      // No desuscribir en cada render; solo al desmontar la app o al logout
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      useProfileStore.getState().reset();
      usePRStore.getState().reset();
      useBenchmarkStore.getState().reset();
      useAchievementStore.getState().reset();
      useMovementStore.getState().reset();
      useFollowStore.getState().reset();
      useFeedStore.getState().reset();
      useEngagementStore.getState().reset();
      useNotificationStore.getState().reset();
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
