import { useState } from 'react';
import { X, Zap, Check } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import usePRStore from '../stores/prStore';
import useAchievementStore from '../stores/achievementStore';
import { MOVEMENT_CATALOG, CATEGORY_LABELS } from '../data/movements';

export default function PRModal({ initialData, onClose, onSuccess }) {
  const { user } = useAuthStore();
  const { createPR, updatePR, saving, error: storeError } = usePRStore();
  const { checkAchievements } = useAchievementStore();

  const isEdit = Boolean(initialData?.id);

  const [movement, setMovement] = useState(initialData?.movement || 'Back Squat');
  const [value, setValue] = useState(initialData?.value ? String(initialData.value) : '');
  const [unit, setUnit] = useState('lb');
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState(null);

  const handleUnitChange = (newUnit) => {
    if (newUnit === unit) return;
    if (value && !isNaN(parseFloat(value))) {
      const num = parseFloat(value);
      if (newUnit === 'kg') {
        setValue(String(Math.round((num / 2.20462) * 10) / 10));
      } else {
        setValue(String(Math.round(num * 2.20462 * 10) / 10));
      }
    }
    setUnit(newUnit);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!movement.trim() || !value) {
      setError('Por favor ingresa el movimiento y el valor.');
      return;
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue <= 0) {
      setError('El valor debe ser un número positivo.');
      return;
    }

    // Siempre almacenar y registrar en Libras (lb)
    const valueInLb = unit === 'kg' ? Math.round(numericValue * 2.20462 * 10) / 10 : numericValue;

    try {
      setError(null);
      const payload = {
        movement: movement.trim(),
        value: valueInLb,
        value_numeric: valueInLb,
        unit: 'lb',
        date: new Date(date).toISOString(),
        notes: notes.trim() || null,
      };

      if (isEdit) {
        await updatePR(initialData.id, payload);
      } else {
        await createPR(user.id, payload);
      }

      // Validar logros automáticamente
      await checkAchievements(user.id);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving PR:', err);
      setError(err.message || 'Error al guardar el récord');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#FFC815]/15 text-[#FFC815]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEdit ? 'Editar Récord' : 'Registrar Nuevo PR'}
              </h3>
              <p className="text-xs text-[#A0A0A5]">Fuerza y levantamientos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {(error || storeError) && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {error || storeError}
            </div>
          )}

          {/* Movimiento */}
          <div>
            <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
              Ejercicio / Movimiento
            </label>
            <select
              value={movement}
              onChange={(e) => setMovement(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-semibold text-white focus:outline-none focus:border-[#FFC815]"
            >
              {MOVEMENT_CATALOG.map((m) => (
                <option key={m.name} value={m.name} className="bg-[#1C1C1E]">
                  {m.name} ({CATEGORY_LABELS[m.category] || m.category})
                </option>
              ))}
            </select>
          </div>

          {/* Valor y Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
                Peso / Marca
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={unit === 'kg' ? 'Ej. 100' : 'Ej. 225'}
                required
                className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white focus:outline-none focus:border-[#FFC815]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
                Unidad entrada
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#0A0A0C] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => handleUnitChange('lb')}
                  className={`py-2 rounded-lg text-xs font-black transition-colors ${
                    unit === 'lb' ? 'bg-[#FFC815] text-black shadow-md' : 'text-gray-400'
                  }`}
                >
                  LB
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitChange('kg')}
                  className={`py-2 rounded-lg text-xs font-black transition-colors ${
                    unit === 'kg' ? 'bg-[#FFC815] text-black shadow-md' : 'text-gray-400'
                  }`}
                >
                  KG
                </button>
              </div>
            </div>
          </div>

          {/* Indicador de conversión si ingresa en KG */}
          {unit === 'kg' && value && !isNaN(parseFloat(value)) && (
            <div className="p-2.5 rounded-xl bg-[#FFC815]/10 border border-[#FFC815]/20 flex items-center justify-between text-xs">
              <span className="text-[#A0A0A5]">Equivalente a almacenar:</span>
              <span className="font-black text-[#FFC815]">
                {Math.round(parseFloat(value) * 2.20462 * 10) / 10} lb
              </span>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-semibold text-white focus:outline-none focus:border-[#FFC815]"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
              Notas / Sensaciones (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sensación sólida, nueva técnica..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815] resize-none"
            />
          </div>

          {/* Botón Guardar */}
          <button
            type="submit"
            disabled={saving}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#FFC815] hover:bg-[#ffc815]/90 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg tap-bounce disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{saving ? 'Guardando...' : isEdit ? 'Actualizar Récord' : 'Guardar Récord'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
