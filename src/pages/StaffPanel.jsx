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
    updateMembership,
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
  const [accessGranted, setAccessGranted] = useState(true);

  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGymOverview();
  }, []);

  const isStaff = profile?.role === 'admin' || profile?.role === 'coach';

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
  };

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (!selectedAthlete || !concept.trim() || !amount) return;

    try {
      setSubmitting(true);
      setStatusMessage(null);
      await addDebt({
        userId: selectedAthlete.id,
        concept: concept.trim(),
        category,
        amount: parseFloat(amount),
        notes: debtNotes.trim() || null,
        createdBy: user.id,
      });

      setStatusMessage({ type: 'success', text: 'Cargo registrado correctamente.' });
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
        userId: selectedAthlete.id,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        notes: paymentNotes.trim() || null,
        recordedBy: user.id,
      });

      setStatusMessage({ type: 'success', text: 'Abono registrado y saldo actualizado.' });
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
      await updateMembership({
        userId: selectedAthlete.id,
        documentId: selectedAthlete.document_id || 'SIN_DOC',
        planName,
        endDate: new Date(endDate).toISOString(),
        status: 'active',
        accessGranted,
      });

      setStatusMessage({ type: 'success', text: 'Membresía renovada exitosamente.' });
      fetchGymOverview();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al actualizar membresía' });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingDebts = selectedAthleteDebts.filter((d) => d.status !== 'paid');

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
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">
            Total en Deudas
          </span>
          <span className="text-xl font-black text-amber-400 mt-1">
            {formatCOP(overview.totalPendingAmount)}
          </span>
          <span className="text-[10px] text-gray-400 mt-1">
            {overview.debtorsCount} atletas con saldo
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">
            Membresías en Mora
          </span>
          <span className="text-xl font-black text-red-400 mt-1">
            {overview.overdueCount} atletas
          </span>
          <span className="text-[10px] text-gray-400 mt-1">
            {overview.expiringSoonCount} por vencer esta semana
          </span>
        </div>
      </div>

      {/* Buscador de Atletas */}
      <div className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-3">
        <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
          1. Seleccionar Atleta
        </span>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Buscar por nombre, cédula o @handle..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
          />
        </div>

        {/* Lista de resultados de búsqueda */}
        {searchQuery.trim().length > 0 && (
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl bg-[#0A0A0C]">
            {searching ? (
              <div className="p-4 text-center text-xs text-[#A0A0A5]">Buscando...</div>
            ) : athletes.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#A0A0A5]">No hay coincidencias.</div>
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
                    <h5 className="text-xs font-bold text-white">{a.full_name || a.display_name}</h5>
                    <span className="text-[10px] text-[#A0A0A5]">
                      Cédula: {a.document_id || 'Sin cédula'} · @{a.display_name}
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
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-[#FFC815]/30 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FFC815]">
                Atleta Activo en POS
              </span>
              <h3 className="text-base font-black text-white">
                {selectedAthlete.full_name || selectedAthlete.display_name}
              </h3>
              <span className="text-xs text-[#A0A0A5]">
                Cédula: {selectedAthlete.document_id || 'No vinculada'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                Deuda Total
              </span>
              <span className="text-lg font-black text-amber-400">
                {formatCOP(
                  pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0)
                )}
              </span>
            </div>
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
                <span>Cargar Implemento o Suplemento</span>
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
                {/* Botones de montos sugeridos rápidos */}
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
                  placeholder="Ej. Pendiente de pago para el viernes"
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
                    Este atleta no tiene deudas pendientes.
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
                    <option value="">-- Elige un ítem --</option>
                    {pendingDebts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.concept} (Resta {formatCOP(d.balance)})
                      </option>
                    ))}
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

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A0A0C] border border-white/5">
                <span className="text-xs font-bold text-gray-300">
                  Permitir Acceso Puerta / Huellero
                </span>
                <input
                  type="checkbox"
                  checked={accessGranted}
                  onChange={(e) => setAccessGranted(e.target.checked)}
                  className="w-5 h-5 accent-[#FFC815] rounded cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 py-3 rounded-xl bg-[#FFC815] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 tap-bounce disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 stroke-[3]" />
                <span>{submitting ? 'Actualizando...' : 'Guardar y Sincronizar'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
