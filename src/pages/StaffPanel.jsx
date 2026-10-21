import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  ShoppingBag,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  ArrowLeft,
  Users,
  DollarSign,
  Fingerprint,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import useStaffStore from '../stores/staffStore';
import { formatCOP } from '../utils/currency';

export default function StaffPanel() {
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const {
    athletes,
    searchAthletes,
    searching,
    selectedAthlete,
    selectedAthleteDebts,
    selectedAthleteMembership,
    selectAthlete,
    addDebt,
    addPayment,
    renewMembership,
    pendingLinkRequests,
    loadingRequests,
    fetchPendingLinkRequests,
    reviewLinkRequest,
    overview,
    fetchGymOverview,
  } = useStaffStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeAction, setActiveAction] = useState('debt'); // 'debt' | 'payment' | 'membership'

  // Form states - Nueva Deuda
  const [concept, setConcept] = useState('Bebida Hidratante');
  const [category, setCategory] = useState('beverage');
  const [amount, setAmount] = useState('6000');
  const [debtNotes, setDebtNotes] = useState('');

  // Form states - Pago/Abono
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('nequi');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Form states - Membresía
  const [planName, setPlanName] = useState('Mensualidad Ilimitada');
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [renewalAmount, setRenewalAmount] = useState('150000');
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState('cash');

  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGymOverview();
    fetchPendingLinkRequests();
  }, []);

  const isStaff =
    profile?.isStaff ||
    profile?.roles?.includes('admin') ||
    profile?.roles?.includes('coach') ||
    profile?.roles?.includes('head_coach') ||
    profile?.role === 'admin' ||
    profile?.role === 'coach';

  if (!isStaff) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white">Acceso Restringido</h3>
        <p className="text-xs text-[#A0A0A5] mt-1 max-w-xs">
          Esta sección está disponible únicamente para administradores y coaches de RöK BoX.
        </p>
        <Link
          to="/"
          className="mt-6 px-4 py-2.5 rounded-xl bg-[#FFC815] text-black font-extrabold text-xs tap-bounce"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    searchAthletes(q);
  };

  const handleSelectAthlete = async (athlete) => {
    await selectAthlete(athlete);
    setStatusMessage(null);
    setSelectedDebtId('');
    setPaymentAmount('');
  };

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !concept.trim() || !amount) return;

    try {
      setSubmitting(true);
      setStatusMessage(null);
      await addDebt({
        memberId: selectedAthlete.id,
        concept: concept.trim(),
        amount: parseFloat(amount),
        notes: debtNotes.trim() || null,
        createdBy: user?.id,
      });

      setStatusMessage({ type: 'success', text: 'Cargo registrado correctamente en la cuenta del atleta.' });
      setAmount('6000');
      setDebtNotes('');
      fetchGymOverview();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al registrar deuda' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedDebtId || !paymentAmount) {
      setStatusMessage({ type: 'error', text: 'Selecciona una deuda y el valor a abonar.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);
      await addPayment({
        debtId: selectedDebtId,
        memberId: selectedAthlete.id,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        notes: paymentNotes.trim() || null,
        recordedBy: user?.id,
      });

      setStatusMessage({ type: 'success', text: 'Abono registrado y saldo recalculado automáticamente.' });
      setPaymentAmount('');
      setPaymentNotes('');
      fetchGymOverview();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al registrar abono' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMembership = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !endDate) return;

    try {
      setSubmitting(true);
      setStatusMessage(null);
      await renewMembership({
        memberId: selectedAthlete.id,
        planName,
        periodEnd: new Date(endDate + 'T23:59:59-05:00').toISOString(),
        amount: parseFloat(renewalAmount || '0'),
        paymentMethod: renewalPaymentMethod,
      });

      setStatusMessage({ type: 'success', text: 'Membresía renovada y acceso sincronizado exitosamente.' });
      fetchGymOverview();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al actualizar membresía' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewLink = async (requestId, approve) => {
    try {
      setSubmitting(true);
      setStatusMessage(null);
      await reviewLinkRequest(requestId, approve);
      setStatusMessage({
        type: 'success',
        text: approve
          ? 'Solicitud de vínculo aprobada. Cédula y perfil vinculados exitosamente.'
          : 'Solicitud de vínculo rechazada.',
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al procesar solicitud' });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingDebts = selectedAthleteDebts.filter((d) => d.balance > 0);

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white tap-bounce"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la App</span>
        </Link>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFC815]/15 border border-[#FFC815]/30 text-[#FFC815] text-xs font-black">
          <ShieldCheck className="w-4 h-4" />
          <span>Staff Box POS</span>
        </div>
      </div>

      {/* Box Overview Counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#A0A0A5]">
            Total Deudas
          </span>
          <span className="text-base sm:text-lg font-black text-amber-400 mt-1">
            {formatCOP(overview.totalPendingAmount)}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">
            {overview.debtorsCount} con saldo
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#A0A0A5]">
            Membresías
          </span>
          <span className="text-base sm:text-lg font-black text-red-400 mt-1">
            {overview.overdueCount} vencidas
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">
            {overview.expiringSoonCount} por vencer
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#A0A0A5]">
            Vínculos Cédula
          </span>
          <span className="text-base sm:text-lg font-black text-[#FFC815] mt-1">
            {overview.pendingRequestsCount} pend.
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5">
            por verificar
          </span>
        </div>
      </div>

      {/* Sección Solicitudes de Vínculo de Cédula (Si hay pendientes) */}
      {pendingLinkRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Solicitudes de Vínculo Pendientes ({pendingLinkRequests.length})</span>
            </h4>
            <button
              onClick={() => fetchPendingLinkRequests()}
              className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refrescar</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-300">
            Atletas que han ingresado su cédula desde la app para vincular su cuenta con el huellero:
          </p>

          <div className="flex flex-col gap-2">
            {pendingLinkRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-[#0A0A0C] border border-white/10 flex items-center justify-between gap-3"
              >
                <div>
                  <h5 className="text-xs font-black text-white">
                    {req.profiles?.first_name && req.profiles?.last_name
                      ? `${req.profiles.first_name} ${req.profiles.last_name}`
                      : req.profiles?.display_name || 'Atleta'}
                  </h5>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#A0A0A5]">
                    <span>Cédula: <strong className="text-white">{req.document_id}</strong></span>
                    {req.profiles?.display_name && <span>(@{req.profiles.display_name})</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={submitting}
                    onClick={() => handleReviewLink(req.id, true)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black font-extrabold text-[11px] flex items-center gap-1 tap-bounce transition-all disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleReviewLink(req.id, false)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-extrabold text-[11px] flex items-center gap-1 tap-bounce transition-all disabled:opacity-50"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador de Atletas / Miembros */}
      <div className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-3">
        <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
          1. Seleccionar Atleta / Miembro
        </span>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Buscar por nombre o cédula..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
          />
        </div>

        {/* Lista de resultados de búsqueda */}
        {searchQuery.trim().length > 0 && (
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl bg-[#0A0A0C]">
            {searching ? (
              <div className="p-4 text-center text-xs text-[#A0A0A5]">Buscando miembros...</div>
            ) : athletes.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#A0A0A5]">No hay atletas coincidentes.</div>
            ) : (
              athletes.map((a) => (
                <div
                  key={a.id}
                  onClick={() => handleSelectAthlete(a)}
                  className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 ${
                    selectedAthlete?.id === a.id ? 'bg-[#FFC815]/10 border-l-4 border-[#FFC815]' : ''
                  }`}
                >
                  <div>
                    <h5 className="text-xs font-bold text-white">{a.full_name}</h5>
                    <span className="text-[10px] text-[#A0A0A5]">
                      Cédula: {a.document_id || 'Sin cédula'}
                      {a.profiles?.display_name ? ` · @${a.profiles.display_name}` : ''}
                    </span>
                  </div>
                  <span className="text-xs font-black text-[#FFC815]">Seleccionar</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Atleta Seleccionado y Operaciones POS */}
      {selectedAthlete && (
        <div className="flex flex-col gap-4">
          {/* Card Atleta Activo */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-[#FFC815]/30 flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFC815]">
                  Atleta Seleccionado
                </span>
                <h3 className="text-base font-black text-white">
                  {selectedAthlete.full_name}
                </h3>
                <span className="text-xs text-[#A0A0A5]">
                  Cédula: {selectedAthlete.document_id || 'No vinculada'}
                  {selectedAthlete.phone ? ` · Tel: ${selectedAthlete.phone}` : ''}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Deuda Pendiente
                </span>
                <span className="text-lg font-black text-amber-400">
                  {formatCOP(
                    pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0)
                  )}
                </span>
              </div>
            </div>

            {/* Resumen Membresía del Atleta Seleccionado */}
            {selectedAthleteMembership && (
              <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#A0A0A5]">Plan:</span>
                  <span className="font-bold text-white">
                    {selectedAthleteMembership.plan_name || 'Sin plan'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      selectedAthleteMembership.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : selectedAthleteMembership.status === 'expiring_soon'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {selectedAthleteMembership.status === 'active'
                      ? 'Activo'
                      : selectedAthleteMembership.status === 'expiring_soon'
                      ? `Vence pronto (${selectedAthleteMembership.days_left}d)`
                      : selectedAthleteMembership.status === 'overdue'
                      ? 'Vencido'
                      : 'Inactivo'}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      selectedAthleteMembership.turnstile_status === 'granted'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    Huellero: {selectedAthleteMembership.turnstile_status === 'granted' ? 'Habilitado' : 'Bloqueado'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Tabs: Deuda / Pago / Membresía */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#1C1C1E] border border-white/5">
            <button
              type="button"
              onClick={() => setActiveAction('debt')}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                activeAction === 'debt'
                  ? 'bg-[#FFC815] text-black shadow-md'
                  : 'text-[#A0A0A5] hover:text-white'
              }`}
            >
              Cargar Deuda
            </button>
            <button
              type="button"
              onClick={() => setActiveAction('payment')}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                activeAction === 'payment'
                  ? 'bg-[#FFC815] text-black shadow-md'
                  : 'text-[#A0A0A5] hover:text-white'
              }`}
            >
              Registrar Abono
            </button>
            <button
              type="button"
              onClick={() => setActiveAction('membership')}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                activeAction === 'membership'
                  ? 'bg-[#FFC815] text-black shadow-md'
                  : 'text-[#A0A0A5] hover:text-white'
              }`}
            >
              Membresía
            </button>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form 1: Cargar Deuda */}
          {activeAction === 'debt' && (
            <form onSubmit={handleCreateDebt} className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#FFC815]" />
                <span>Cargar Implemento o Consumo</span>
              </h4>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white"
                >
                  <option value="beverage">Bebida Hidratante</option>
                  <option value="supplement">Suplemento (Proteína, Creatina)</option>
                  <option value="equipment">Implemento (Calleras, Muñequeras)</option>
                  <option value="membership_balance">Saldo / Cuota de Mensualidad</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Concepto del Producto
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej. Bebida Isotónica Gatorade"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Monto en Pesos Colombianos (COP)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="6000"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-black text-white focus:outline-none focus:border-[#FFC815]"
                />
                <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {[5000, 6000, 10000, 30000, 85000, 150000].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAmount(String(s))}
                      className="px-2.5 py-1 rounded-lg bg-[#292929] text-[10px] font-bold text-gray-300 hover:text-white"
                    >
                      {formatCOP(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Notas (Opcional)
                </label>
                <input
                  type="text"
                  value={debtNotes}
                  onChange={(e) => setDebtNotes(e.target.value)}
                  placeholder="Ej. Entregado en recepción"
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 py-3 rounded-xl bg-[#FFC815] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 tap-bounce disabled:opacity-50"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{submitting ? 'Guardando...' : 'Asignar Deuda al Atleta'}</span>
              </button>
            </form>
          )}

          {/* Form 2: Registrar Abono */}
          {activeAction === 'payment' && (
            <form onSubmit={handleRecordPayment} className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Registrar Abono o Pago</span>
              </h4>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Seleccionar Deuda a Liquidar
                </label>
                {pendingDebts.length === 0 ? (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl">
                    Este atleta no tiene deudas pendientes con saldo.
                  </p>
                ) : (
                  <select
                    value={selectedDebtId}
                    onChange={(e) => {
                      setSelectedDebtId(e.target.value);
                      const debt = pendingDebts.find((d) => d.id === e.target.value);
                      if (debt) setPaymentAmount(String(debt.balance));
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white"
                  >
                    <option value="">-- Elige un ítem pendiente --</option>
                    {pendingDebts.map((d) => {
                      const label =
                        d.debt_items?.[0]?.item_name ||
                        d.notes ||
                        `Deuda del ${new Date(d.created_at).toLocaleDateString('es-CO')}`;
                      return (
                        <option key={d.id} value={d.id}>
                          {label} (Resta {formatCOP(d.balance)})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Monto a Abonar (COP)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Monto abonado"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-black text-white focus:outline-none focus:border-[#FFC815]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white"
                >
                  <option value="nequi">Nequi</option>
                  <option value="cash">Efectivo</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="card">Datáfono / Tarjeta</option>
                  <option value="transfer">Transferencia Bancaria</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || pendingDebts.length === 0}
                className="mt-2 py-3 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 tap-bounce disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 stroke-[3]" />
                <span>{submitting ? 'Registrando...' : 'Confirmar Abono'}</span>
              </button>
            </form>
          )}

          {/* Form 3: Membresía */}
          {activeAction === 'membership' && (
            <form onSubmit={handleUpdateMembership} className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FFC815]" />
                <span>Renovación de Membresía & Huellero</span>
              </h4>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Plan de Membresía
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                  Nueva Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                    Valor Cobrado (COP)
                  </label>
                  <input
                    type="number"
                    value={renewalAmount}
                    onChange={(e) => setRenewalAmount(e.target.value)}
                    placeholder="150000"
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={renewalPaymentMethod}
                    onChange={(e) => setRenewalPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="card">Datáfono</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 py-3 rounded-xl bg-[#FFC815] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 tap-bounce disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 stroke-[3]" />
                <span>{submitting ? 'Renovando...' : 'Renovar y Habilitar Huellero'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
