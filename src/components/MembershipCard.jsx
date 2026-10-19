import { useState } from 'react';
import { Calendar, Fingerprint, AlertCircle, CheckCircle2, Clock, Lock, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useMembershipStore from '../stores/membershipStore';
import useProfileStore from '../stores/profileStore';

export default function MembershipCard() {
  const { membership, loading, fetchMembership } = useMembershipStore();
  const { profile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMembership(profile?.id, profile?.document_id);
    setRefreshing(false);
  };

  const hasDocument = Boolean(profile?.document_id);

  if (!hasDocument) {
    return (
      <div className="w-full p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-[#FFC815]/30 shadow-lg relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#FFC815]/10 border border-[#FFC815]/20 text-[#FFC815] shrink-0 mt-0.5">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">Vincular con Acceso del Box</h4>
            <p className="text-xs text-[#A0A0A5] mt-1 leading-relaxed">
              Registra tu número de cédula en tu perfil para consultar la vigencia de tu mensualidad y tu estado en el huellero HikCentral.
            </p>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-[#FFC815] text-black font-extrabold text-xs tap-bounce"
            >
              <span>Ingresar Cédula</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
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
      <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#292929] text-gray-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Sin Mensualidad Registrada</h4>
            <p className="text-xs text-[#A0A0A5]">No hay membresía vinculada a la cédula {profile.document_id}</p>
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
