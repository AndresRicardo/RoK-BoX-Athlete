import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';

// Protege las pantallas de Gestión. La seguridad real está en la base (RLS y RPC);
// esto solo evita mostrar pantallas que el usuario no puede usar.
export default function StaffRoute({ partnerOnly = false, children }) {
  const user = useAuthStore((state) => state.user);
  const { isStaff, isPartner, rolesLoaded, loading, error, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (user?.id && !rolesLoaded && !loading && !error) fetchProfile(user.id).catch(() => {});
  }, [user?.id, rolesLoaded, loading, error, fetchProfile]);

  if (!rolesLoaded) {
    return (
      <div className="p-8 text-center text-xs text-[#A0A0A5] flex flex-col items-center gap-3">
        {error ? (
          <>
            <span>No se pudieron cargar tus permisos.</span>
            <button
              type="button"
              onClick={() => fetchProfile(user?.id).catch(() => {})}
              className="px-4 py-2 rounded-xl bg-[#FFC815] text-black font-black tap-bounce"
            >
              Reintentar
            </button>
          </>
        ) : (
          'Cargando...'
        )}
      </div>
    );
  }
  if (partnerOnly ? !isPartner : !isStaff) {
    return <Navigate to={isStaff ? '/manage' : '/'} replace />;
  }
  return children;
}
