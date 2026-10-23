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
  Clock3,
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import useMembershipStore from '../stores/membershipStore';
import useDebtStore from '../stores/debtStore';
import useFollowStore from '../stores/followStore';
import FollowListModal from '../components/FollowListModal';
import MembershipCard from '../components/MembershipCard';
import DebtCard from '../components/DebtCard';
import PaymentHistory from '../components/PaymentHistory';

const DEFAULT_BOX = 'RöK BoX';
const HANDLE_REGEX = /^[a-z0-9._]{3,20}$/;
const normalizeHandle = (v) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);

// Cualquier variante ("rok box", "ROCK BOX", "Rök Box CrossFit"...) se guarda
// como DEFAULT_BOX para que Comunidad agrupe a todos los atletas del box.
const normalizeBox = (v) => {
  const clean = v.trim();
  const key = clean.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return /ro(k|c|ck)box/.test(key) ? DEFAULT_BOX : clean;
};

const GENDERS = [
  ['', 'Prefiero no decirlo'],
  ['male', 'Masculino'],
  ['female', 'Femenino'],
  ['other', 'Otro'],
];

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FFC815]';
const selectClass = 'w-full px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

// Datos del formulario a partir del perfil guardado o, si es nuevo, de la cuenta Google.
function formFromProfile(p, user) {
  const meta = user?.user_metadata || {};
  const googleFirst = meta.given_name || meta.full_name?.split(' ')[0] || '';
  return {
    firstName: p?.first_name || googleFirst,
    lastName: p?.last_name || meta.family_name || meta.full_name?.split(' ').slice(1).join(' ') || '',
    handle: p?.display_name || normalizeHandle(googleFirst),
    boxName: p?.box_name || DEFAULT_BOX,
    discipline: p?.discipline || 'rx',
    birthDate: p?.birth_date || '',
    gender: p?.gender && p.gender !== 'prefer_not_to_say' ? p.gender : '',
    heightCm: p?.height_cm != null ? String(p.height_cm) : '',
    experienceYears: p?.experience_years != null ? String(p.experience_years) : '',
    goal: p?.goal || '',
  };
}

export default function Profile() {
  const { user, signOut } = useAuthStore();
  const { profile, fetchProfile, upsertProfile, saving } = useProfileStore();
  const { member, linkRequest, fetchMembership, requestLink } = useMembershipStore();
  const { fetchMyDebts } = useDebtStore();
  const {
    following = [],
    followers = [],
    network,
    fetchNetwork,
  } = useFollowStore();

  const followersCount = followers?.length ?? network?.followers?.length ?? 0;
  const followingCount = following?.length ?? network?.following?.length ?? 0;

  const [documentId, setDocumentId] = useState('');
  const [form, setForm] = useState(() => formFromProfile(null, null));
  const [weightVal, setWeightVal] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: null });
  const [followModal, setFollowModal] = useState({ open: false, type: 'followers' });

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id).then((p) => {
        setForm(formFromProfile(p, user));
        // Sin perfil todavía: abrir el formulario para completarlo
        if (!p) setIsEditing(true);
        if (p) {
          if (p.weight_kg) {
            setWeightVal(String(Math.round(p.weight_kg * 2.20462 * 10) / 10));
            setWeightUnit('lb');
          } else {
            setWeightVal('');
          }
        }
      });
      fetchMembership(user.id);
      fetchMyDebts(user.id);
      fetchNetwork(user.id);
    }
  }, [user?.id]);

  // Mantener sincronizada la cédula con member o linkRequest
  useEffect(() => {
    const activeDoc = member?.document_id || linkRequest?.document_id || '';
    setDocumentId(activeDoc);
  }, [member?.document_id, linkRequest?.document_id]);

  const setField = (name) => (e) => {
    const value = name === 'handle' ? normalizeHandle(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

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

  const isStaff = profile?.isStaff || profile?.role === 'coach' || profile?.role === 'admin';

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFeedback({ type: 'error', message: 'Nombre y apellidos son obligatorios.' });
      return;
    }
    if (!HANDLE_REGEX.test(form.handle)) {
      setFeedback({
        type: 'error',
        message: 'El @usuario debe tener de 3 a 20 caracteres: minúsculas, números, punto o guion bajo.',
      });
      return;
    }

    try {
      setFeedback({ type: null, message: null });
      const cleanDoc = documentId.trim();

      let finalWeightKg = null;
      if (weightVal && !isNaN(parseFloat(weightVal))) {
        const num = parseFloat(weightVal);
        finalWeightKg = weightUnit === 'lb' ? Math.round((num / 2.20462) * 10) / 10 : num;
      }

      // Guardar datos de perfil sin document_id (vive en members/link_requests)
      await upsertProfile(user.id, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        display_name: form.handle,
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        box_name: normalizeBox(form.boxName) || null,
        discipline: form.discipline,
        birth_date: form.birthDate || null,
        gender: form.gender || null,
        weight_kg: finalWeightKg,
        height_cm: form.heightCm === '' ? null : Number(form.heightCm),
        experience_years: form.experienceYears === '' ? null : Number(form.experienceYears),
        goal: form.goal.trim() || null,
      });

      // Si ingresó o cambió la cédula respecto al miembro actual, solicitar vínculo seguro
      if (!member && cleanDoc && cleanDoc !== linkRequest?.document_id) {
        await requestLink(cleanDoc);
        setFeedback({
          type: 'success',
          message: 'Perfil guardado. Se envió la solicitud de vínculo para la cédula ' + cleanDoc + '.',
        });
      } else {
        setFeedback({ type: 'success', message: 'Perfil actualizado exitosamente.' });
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      setFeedback({
        type: 'error',
        message: err?.code === '23505'
          ? `El @usuario ${form.handle} ya está en uso.`
          : err.message || 'Error al guardar cambios',
      });
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

      {/* Staff Panel Link if authorized */}
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
                Modo Staff Habilitado ({(profile?.roles?.[0] || 'staff').toUpperCase()})
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
            <h4 className="text-sm font-bold text-white">{profile ? 'Vínculo HikCentral & Perfil' : 'Completa tu perfil'}</h4>
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
                Número de Cédula / DNI (Solicitud de Vínculo de Acceso)
              </label>
              <input
                id="documentIdInput"
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Ej. 1020304050"
                readOnly={!!member}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FFC815] ${member ? 'opacity-60' : ''}`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {member
                  ? 'Tu cuenta ya está vinculada. Si la cédula es incorrecta, pídele al staff del box que la corrija.'
                  : 'Al guardar, se enviará una solicitud al staff del box para vincular tu acceso biométrico y mensualidad.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *">
                <input type="text" value={form.firstName} onChange={setField('firstName')} className={inputClass} />
              </Field>
              <Field label="Apellidos *">
                <input type="text" value={form.lastName} onChange={setField('lastName')} className={inputClass} />
              </Field>
            </div>

            <Field label="@Usuario *">
              <input
                type="text"
                value={form.handle}
                onChange={setField('handle')}
                placeholder="usuario"
                className={inputClass}
              />
            </Field>

            <Field label="Box">
              <input
                type="text"
                list="boxSuggestions"
                value={form.boxName}
                onChange={setField('boxName')}
                placeholder={DEFAULT_BOX}
                className={inputClass}
              />
              <datalist id="boxSuggestions">
                <option value={DEFAULT_BOX} />
              </datalist>
              {form.boxName !== DEFAULT_BOX && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, boxName: DEFAULT_BOX }))}
                  className="mt-1.5 px-2.5 py-1 rounded-lg bg-[#FFC815]/15 border border-[#FFC815]/40 text-[11px] font-black text-[#FFC815] tap-bounce"
                >
                  Usar “{DEFAULT_BOX}”
                </button>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría">
                <select value={form.discipline} onChange={setField('discipline')} className={selectClass}>
                  <option value="rx">RX</option>
                  <option value="scaled">Scaled</option>
                  <option value="masters">Masters</option>
                  <option value="beginner">Principiante</option>
                </select>
              </Field>

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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nacimiento">
                <input type="date" value={form.birthDate} onChange={setField('birthDate')} className={selectClass} />
              </Field>
              <Field label="Género">
                <select value={form.gender} onChange={setField('gender')} className={selectClass}>
                  {GENDERS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Altura (cm)">
                <input
                  type="number"
                  min="1"
                  max="299"
                  value={form.heightCm}
                  onChange={setField('heightCm')}
                  placeholder="Ej. 175"
                  className={inputClass}
                />
              </Field>
              <Field label="Años entrenando">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={form.experienceYears}
                  onChange={setField('experienceYears')}
                  placeholder="Ej. 2"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Objetivo">
              <textarea
                rows={2}
                value={form.goal}
                onChange={setField('goal')}
                placeholder="Ej. Mi primer muscle-up"
                className={`${inputClass} resize-none`}
              />
            </Field>

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
              <span className="text-[#A0A0A5]">Estado del Vínculo:</span>
              {member?.document_id ? (
                <span className="font-bold text-emerald-400 font-mono flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>CC: {member.document_id}</span>
                </span>
              ) : linkRequest?.status === 'pending' ? (
                <span className="font-bold text-amber-400 font-mono flex items-center gap-1">
                  <Clock3 className="w-3.5 h-3.5" />
                  <span>CC: {linkRequest.document_id} (En revisión)</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setTimeout(() => document.getElementById('documentIdInput')?.focus(), 150);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#FFC815] text-black font-extrabold text-[11px] tap-bounce shadow-sm"
                >
                  + Solicitar Vínculo
                </button>
              )}
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-[#A0A0A5]">Box:</span>
              <span className="font-bold text-white">{profile?.box_name || 'No registrado'}</span>
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
        <PaymentHistory />
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
