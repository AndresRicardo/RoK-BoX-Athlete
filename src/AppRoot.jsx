import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import useAuthStore from './stores/authStore';
import useProfileStore from './stores/profileStore';

export default function AppRoot() {
  const { initialize, user } = useAuthStore();
  const { syncAvatar } = useProfileStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sincronizar foto de perfil de Google OAuth con la base de datos
  useEffect(() => {
    if (user?.id && user.user_metadata?.avatar_url) {
      syncAvatar(user.id, user.user_metadata.avatar_url);
    }
  }, [user?.id, user?.user_metadata?.avatar_url, syncAvatar]);

  return <RouterProvider router={router} />;
}
