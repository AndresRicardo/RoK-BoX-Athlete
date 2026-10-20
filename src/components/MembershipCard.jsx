import { useState } from 'react';
import { Calendar, Fingerprint, AlertCircle, CheckCircle2, Clock, Lock, RefreshCw, ChevronRight, X, Edit2 } from 'lucide-react';
import useMembershipStore from '../stores/membershipStore';
import useProfileStore from '../stores/profileStore';
import useAuthStore from '../stores/authStore';

export default function MembershipCard({ onEnterDocument }) {
  const { user } = useAuthStore();
  const { membership, loading, fetchMembership } = useMembershipStore();
  const { profile, upsertProfile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);

  // Modal para ingresar / editar cédula directamente
  const [modalOpen, setModalOpen] = useState(false);
  const [docInput, setDocInput] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMembership(profile?.id || user?.id, profile?.document_id);
    setRefreshing(false);
  };

  const handleOpenDocModal = () => {
    if (typeof onEnterDocument === 'function') {
      onEnterDocument();
      return;
    }
    setDocInput(profile?.document_id || '');
    setDocError(null);
    setModalOpen(true);
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    const clean = docInput.trim();
    if (!clean) {
      setDocError('Por favor ingresa un número de cédula válido.');
      return;
    }

    const userId = profile?.id || user?.id;
    if (!userId) {
      setDocError('Sesión no encontrada.');
      return;
    }

    try {
      setSavingDoc(true);
      setDocError(null);

      await upsertProfile(userId, {
        first_name: profile?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Atleta',
        last_name: profile?.last_name || user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        display_name: profile?.display_name || user?.email?.split('@')[0] || 'atleta',
        document_id: clean,
      });

      await fetchMembership(userId, clean);
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving document in card:', err);
      setDocError(err.message || 'Error al guardar la cédula');
    } finally {
      setSavingDoc(false);
    }
  };

  const hasDocument = Boolean(profile?.document_id);

  if (!hasDocument) {
    return (
      <>
        <div className="w-full p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-[#FFC815]/30 shadow-lg relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFC815]/10 border border-[#FFC815]/20 text-[#FFC815] shrink-0 mt-0.5">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Vincular con Acceso del Box</h4>
              <p className="text-xs text-[#A0A0A5] mt-1 leading-relaxed">
                Registra tu número de cédula para consultar la vigencia de tu mensualidad y verificar tu acceso en el huellero HikCentral.
              </p>
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 rounded-xl bg-[#FFC815] text-black font-extrabold text-xs tap-bounce shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <Fingerprint className="w-4 h-4 stroke-[2.5]" />
                <span>Ingresar Cédula</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal de Ingreso de Cédula */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl border border-white/10 shadow-2xl p-5 flex flex-col gap-4 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#FFC815]/15 text-[#FFC815]">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Vincular Cédula / DNI</h3>
                    <p className="text-[11px] text-[#A0A0A5]">Acceso HikCentral del box</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDocument} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
                    Número de Cédula
                  </label>
                  <input
                    type="text"
                    value={docInput}
                    onChange={(e) => setDocInput(e.target.value)}
                    placeholder="Ej. 1020304050"
                    autoFocus
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white focus:outline-none focus:border-[#FFC815]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    Debe coincidir con la cédula registrada en el software HikCentral del box para verificar tu acceso biométrico y tu mensualidad.
                  </p>
                </div>

                {docError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {docError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="px-4 py-2 rounded-xl bg-[#FFC815] text-black font-black text-xs tap-bounce shadow-md disabled:opacity-50"
                  >
                    {savingDoc ? 'Vinculando...' : 'Vincular y Consultar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  if (loading && !membership) {
    return (
      <div className="w-full p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 animate-pulse flex items-center justify-center min-h-[120px]">
        <div className="flex items-center gap-2 text-xs text-[#A0A0A5]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#FFC815]" />
          <span>Consultando estado en el box...</span>
        </div>
      </div>
    );
  }

  if (!membership) {
    return (
      <>
        <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#292929] text-gray-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Sin Mensualidad Registrada</h4>
                <button
                  type="button"
                  onClick={handleOpenDocModal}
                  className="text-[10px] text-[#FFC815] hover:underline inline-flex items-center gap-0.5"
                  title="Cambiar cédula"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>CC: {profile.document_id}</span>
                </button>
              </div>
              <p className="text-xs text-[#A0A0A5]">No hay membresía activa vinculada a esta cédula</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-[#292929] text-gray-300 tap-bounce"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Modal de edición de cédula si la cambian */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl border border-white/10 shadow-2xl p-5 flex flex-col gap-4 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#FFC815]/15 text-[#FFC815]">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Actualizar Cédula</h3>
                    <p className="text-[11px] text-[#A0A0A5]">Acceso HikCentral del box</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDocument} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5] block mb-1">
                    Número de Cédula
                  </label>
                  <input
                    type="text"
                    value={docInput}
                    onChange={(e) => setDocInput(e.target.value)}
                    placeholder="Ej. 1020304050"
                    autoFocus
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white focus:outline-none focus:border-[#FFC815]"
                  />
                </div>

                {docError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {docError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="px-4 py-2 rounded-xl bg-[#FFC815] text-black font-black text-xs tap-bounce shadow-md disabled:opacity-50"
                  >
                    {savingDoc ? 'Actualizando...' : 'Actualizar y Consultar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // Colores e iconos de estado
  const isOverdue = membership.isOverdue;
  const isExpiringSoon = membership.isExpiringSoon;

  const statusBadge = isOverdue ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-500/15 border border-red-500/30 text-red-400">
      <AlertCircle className="w-3.5 h-3.5" />
      En Mora ({Math.abs(membership.daysRemaining)}d)
    </span>
  ) : isExpiringSoon ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 border border-amber-500/30 text-amber-400">
      <Clock className="w-3.5 h-3.5" />
      {membership.daysRemaining === 0 ? 'Vence Hoy' : `Vence en ${membership.daysRemaining}d`}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Al Día ({membership.daysRemaining}d restantes)
    </span>
  );

  const formattedDate = new Date(membership.end_date).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className={`w-full p-4 sm:p-5 rounded-2xl bg-[#1C1C1E] border ${
      isOverdue ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5'
    } shadow-xl relative overflow-hidden`}>
      {/* Background glow decorativo */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none ${
        isOverdue ? 'bg-red-500/10' : isExpiringSoon ? 'bg-amber-500/10' : 'bg-[#FFC815]/10'
      }`} />

      {/* Header card */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#FFC815]" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            {membership.plan_name}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            CC: {profile?.document_id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          <button
            onClick={handleRefresh}
            className="p-1 rounded-lg text-gray-400 hover:text-white tap-bounce"
            title="Refrescar estado"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Info */}
      <div className="flex items-end justify-between mt-2 pt-2 border-t border-white/5">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#A0A0A5] font-semibold block">
            Fecha de Vencimiento
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {formattedDate}
          </span>
        </div>

        {/* Puerta / Biométrico badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
          membership.access_granted && !isOverdue
            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
            : 'bg-red-950/60 border border-red-500/30 text-red-300'
        }`}>
          {membership.access_granted && !isOverdue ? (
            <>
              <Fingerprint className="w-4 h-4 text-emerald-400" />
              <span>Acceso Huella OK</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-red-400" />
              <span>Acceso Bloqueado</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
