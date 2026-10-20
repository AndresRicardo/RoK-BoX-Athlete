import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Fingerprint,
  ShieldCheck,
  LogOut,
  Receipt,
  Users,
  Check,
  AlertCircle,
  Edit2,
  Save,
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import useMembershipStore from '../stores/membershipStore';
import useDebtStore from '../stores/debtStore';
import useFollowStore from '../stores/followStore';
import FollowListModal from '../components/FollowListModal';
import MembershipCard from '../components/MembershipCard';
import DebtCard from '../components/DebtCard';

export default function Profile() {
  const { user, signOut } = useAuthStore();
  const { profile, fetchProfile, upsertProfile, saving } = useProfileStore();
  const { fetchMembership } = useMembershipStore();
  const { fetchMyDebts } = useDebtStore();
  const {
    following = [],
    followers = [],
    network,
    fetchNetwork,
    fetchMyNetwork,
  } = useFollowStore();

  const followersCount = followers?.length ?? network?.followers?.length ?? 0;
  const followingCount = following?.length ?? network?.following?.length ?? 0;

  const [documentId, setDocumentId] = useState('');
  const [handle, setHandle] = useState('');
  const [discipline, setDiscipline] = useState('rx');
  const [weightVal, setWeightVal] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: null });
  const [followModal, setFollowModal] = useState({ open: false, type: 'followers' });

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id).then((p) => {
        if (p) {
          setDocumentId(p.document_id || '');
          setHandle(p.display_name || '');
          setDiscipline(p.discipline || 'rx');
          if (p.weight_kg) {
            setWeightVal(String(Math.round(p.weight_kg * 2.20462 * 10) / 10));
            setWeightUnit('lb');
          } else {
            setWeightVal('');
          }
          fetchMembership(user.id, p.document_id);
        }
      });
      fetchMyDebts(user.id);
      fetchNetwork(user.id);
    }
  }, [user?.id]);

  // Mantener sincronizado si cambia el perfil externamente
  useEffect(() => {
    if (profile) {
      if (profile.document_id !== undefined) setDocumentId(profile.document_id || '');
      if (profile.display_name) setHandle(profile.display_name);
      if (profile.discipline) setDiscipline(profile.discipline);
    }
  }, [profile]);

  const handleWeightUnitChange = (newUnit) => {
    if (newUnit === weightUnit) return;
    if (weightVal && !isNaN(parseFloat(weightVal))) {
      const num = parseFloat(weightVal);
      if (newUnit === 'kg') {
        setWeightVal(String(Math.round((num / 2.20462) * 10) / 10));
      } else {
        setWeightVal(String(Math.round(num * 2.20462 * 10) / 10));
      }
    }
    setWeightUnit(newUnit);
  };

  const isStaff = profile?.role === 'coach' || profile?.role === 'admin';

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!handle.trim()) {
      setFeedback({ type: 'error', message: 'El @handle no puede estar vacío.' });
      return;
    }

    try {
      setFeedback({ type: null, message: null });
      const cleanDoc = documentId.trim() || null;
      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');

      let finalWeightKg = null;
      if (weightVal && !isNaN(parseFloat(weightVal))) {
        const num = parseFloat(weightVal);
        finalWeightKg = weightUnit === 'lb' ? Math.round((num / 2.20462) * 10) / 10 : num;
      }

      await upsertProfile(user.id, {
        first_name: profile?.first_name || user.user_metadata?.full_name?.split(' ')[0] || 'Atleta',
        last_name: profile?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        display_name: cleanHandle,
        document_id: cleanDoc,
        discipline,
        weight_kg: finalWeightKg,
      });

      if (cleanDoc) {
        await fetchMembership(user.id, cleanDoc);
      }

      setIsEditing(false);
      setFeedback({ type: 'success', message: 'Perfil y cédula actualizados exitosamente.' });
    } catch (err) {
      console.error('Error saving profile:', err);
      setFeedback({ type: 'error', message: err.message || 'Error al guardar cambios' });
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header Profile Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-white/10 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FFC815]/50 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#0A0A0C] border-2 border-[#FFC815]/50 flex items-center justify-center text-xl font-black text-[#FFC815] shadow-lg">
              {profile?.first_name?.[0]?.toUpperCase() || 'R'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white truncate">
                {profile?.first_name} {profile?.last_name}
              </h3>
              {profile?.discipline && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#FFC815] text-black shrink-0">
                  {profile.discipline}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-[#A0A0A5] block mt-0.5">
              @{profile?.display_name || 'atleta'}
            </span>
            <span className="text-[11px] text-gray-400 block mt-0.5">{user?.email}</span>
          </div>
        </div>

        {/* Followers / Following Counter */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setFollowModal({ open: true, type: 'followers' })}
            className="p-2.5 rounded-xl bg-[#0A0A0C]/50 border border-white/5 flex flex-col items-center justify-center tap-bounce"
          >
            <span className="text-base font-black text-white">
              {followersCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">
              Seguidores
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFollowModal({ open: true, type: 'following' })}
            className="p-2.5 rounded-xl bg-[#0A0A0C]/50 border border-white/5 flex flex-col items-center justify-center tap-bounce"
          >
            <span className="text-base font-black text-white">
              {followingCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">
              Siguiendo
            </span>
          </button>
        </div>
      </div>

      {/* Staff Mode Access Banner (if Coach or Admin) */}
      {isStaff && (
        <Link
          to="/staff"
          className="p-4 rounded-2xl bg-gradient-to-r from-[#FFC815]/20 via-[#FFC815]/10 to-transparent border border-[#FFC815]/40 flex items-center justify-between tap-bounce shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFC815] text-black">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#FFC815] block">
                Modo Staff Habilitado ({profile.role.toUpperCase()})
              </span>
              <p className="text-xs text-gray-300">
                Gestionar deudas, cobros y atletas del box
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#FFC815] text-black font-extrabold text-xs">
            Abrir
          </span>
        </Link>
      )}

      {/* Feedback Messages */}
      {feedback.message && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Membresía y Huellero HikCentral */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
          Membresía & Control de Acceso
        </span>
        <MembershipCard
          onEnterDocument={() => {
            setIsEditing(true);
            setTimeout(() => {
              document.getElementById('documentIdInput')?.focus();
            }, 150);
          }}
        />
      </div>

      {/* Formulario de Edición de Cédula y Datos */}
      <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-[#FFC815]" />
            <h4 className="text-sm font-bold text-white">Vínculo HikCentral & Perfil</h4>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-bold text-[#FFC815] tap-bounce"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5 pt-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
                Número de Cédula / DNI (Para huellero y puerta)
              </label>
              <input
                id="documentIdInput"
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Ej. 1020304050"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FFC815]"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Debe coincidir con el documento registrado en el PC de HikCentral del box.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
                @Handle único
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="usuario"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FFC815]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
                  Categoría
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
                >
                  <option value="rx">RX</option>
                  <option value="scaled">Scaled</option>
                  <option value="masters">Masters</option>
                  <option value="beginner">Beginner</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">
                    Peso corporal
                  </label>
                  <div className="inline-flex bg-[#0A0A0C] rounded-lg p-0.5 border border-white/10 text-[9px]">
                    <button
                      type="button"
                      onClick={() => handleWeightUnitChange('lb')}
                      className={`px-1.5 py-0.5 rounded font-black ${
                        weightUnit === 'lb' ? 'bg-[#FFC815] text-black' : 'text-gray-400'
                      }`}
                    >
                      LB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWeightUnitChange('kg')}
                      className={`px-1.5 py-0.5 rounded font-black ${
                        weightUnit === 'kg' ? 'bg-[#FFC815] text-black' : 'text-gray-400'
                      }`}
                    >
                      KG
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={weightVal}
                  onChange={(e) => setWeightVal(e.target.value)}
                  placeholder={weightUnit === 'lb' ? 'Ej. 165' : 'Ej. 75'}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FFC815]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 py-3 px-4 rounded-xl bg-[#FFC815] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md tap-bounce disabled:opacity-50"
            >
              <Save className="w-4 h-4 stroke-[3]" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-2 pt-1 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/5 items-center">
              <span className="text-[#A0A0A5]">Cédula vinculada:</span>
              {profile?.document_id ? (
                <span className="font-bold text-white font-mono">{profile.document_id}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setTimeout(() => document.getElementById('documentIdInput')?.focus(), 150);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#FFC815] text-black font-extrabold text-[11px] tap-bounce shadow-sm"
                >
                  + Vincular Cédula
                </button>
              )}
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-[#A0A0A5]">Categoría de entreno:</span>
              <span className="font-bold uppercase text-[#FFC815]">{profile?.discipline || 'RX'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#A0A0A5]">Peso registrado:</span>
              <span className="font-bold text-white">
                {profile?.weight_kg
                  ? `${Math.round(profile.weight_kg * 2.20462 * 10) / 10} lb`
                  : 'No registrado'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Deudas y Cobros */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
          Tienda & Pagos del Box
        </span>
        <DebtCard />
      </div>

      {/* Cerrar Sesión */}
      <button
        type="button"
        onClick={signOut}
        className="w-full py-3.5 px-4 rounded-2xl bg-[#1C1C1E] border border-white/10 hover:border-red-500/40 text-gray-400 hover:text-red-400 font-bold text-xs flex items-center justify-center gap-2 tap-bounce transition-colors mt-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Cerrar Sesión</span>
      </button>

      {/* Modal Seguidores/Siguiendo */}
      {followModal.open && (
        <FollowListModal
          athleteId={user.id}
          type={followModal.type}
          onClose={() => setFollowModal({ open: false, type: 'followers' })}
        />
      )}
    </div>
  );
}
