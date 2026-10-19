import { useState } from 'react';
import { X, Timer, Check } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import useAchievementStore from '../stores/achievementStore';
import { WOD_CATALOG, findWodByName } from '../data/wods';

export default function BenchmarkModal({ initialData, onClose, onSuccess }) {
  const { user } = useAuthStore();
  const { createBenchmark, updateBenchmark, saving, error: storeError } = useBenchmarkStore();
  const { checkAchievements } = useAchievementStore();

  const isEdit = Boolean(initialData?.id);

  const [wodName, setWodName] = useState(initialData?.name || 'Fran');
  const [minutes, setMinutes] = useState(
    initialData?.result && initialData.result.includes(':')
      ? initialData.result.split(':')[0]
      : '3'
  );
  const [seconds, setSeconds] = useState(
    initialData?.result && initialData.result.includes(':')
      ? initialData.result.split(':')[1]
      : '45'
  );
  const [repsValue, setRepsValue] = useState(
    initialData?.result && !initialData.result.includes(':') ? initialData.result : ''
  );
  const [isRx, setIsRx] = useState(initialData?.discipline !== 'scaled');
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState(null);

  const selectedWod = findWodByName(wodName);
  const isForTime = selectedWod?.type === 'for_time';

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalResult = '';

    if (isForTime) {
      const min = parseInt(minutes, 10) || 0;
      const sec = parseInt(seconds, 10) || 0;
      if (min === 0 && sec === 0) {
        setError('Ingresa un tiempo válido.');
        return;
      }
      finalResult = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    } else {
      if (!repsValue.trim()) {
        setError('Ingresa las repeticiones o rondas logradas.');
        return;
      }
      finalResult = repsValue.trim();
    }

    try {
      setError(null);
      const payload = {
        name: wodName,
        type: selectedWod?.type || 'for_time',
        result: finalResult,
        discipline: isRx ? 'rx' : 'scaled',
        date: new Date(date).toISOString(),
        notes: notes.trim() || null,
      };

      if (isEdit) {
        await updateBenchmark(initialData.id, payload);
      } else {
        await createBenchmark(user.id, payload);
      }

      await checkAchievements(user.id);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving benchmark:', err);
      setError(err.message || 'Error al guardar el benchmark');
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
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEdit ? 'Editar Benchmark' : 'Registrar WOD'}
              </h3>
              <p className="text-xs text-[#A0A0A5]">Girls, Heroes y Clásicos</p>
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

          {/* WOD Selector */}
          <div>
            <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
              WOD / Benchmark
            </label>
            <select
              value={wodName}
              onChange={(e) => setWodName(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-semibold text-white focus:outline-none focus:border-[#FFC815]"
            >
              {WOD_CATALOG.map((w) => (
                <option key={w.name} value={w.name} className="bg-[#1C1C1E]">
                  {w.name} ({w.type.replace('_', ' ').toUpperCase()})
                </option>
              ))}
            </select>
            {selectedWod?.description && (
              <p className="text-[11px] text-[#A0A0A5] mt-1.5 px-1 italic">
                {selectedWod.description}
              </p>
            )}
          </div>

          {/* Resultado */}
          {isForTime ? (
            <div>
              <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
                Tiempo Final (Min : Seg)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="Minutos"
                  className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white text-center focus:outline-none focus:border-[#FFC815]"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="Segundos"
                  className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white text-center focus:outline-none focus:border-[#FFC815]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
                Resultado (Reps / Rondas)
              </label>
              <input
                type="text"
                value={repsValue}
                onChange={(e) => setRepsValue(e.target.value)}
                placeholder="Ej. 18 rondas + 5 reps"
                className="w-full px-3.5 py-3 rounded-xl bg-[#0A0A0C] border border-white/10 text-base font-black text-white focus:outline-none focus:border-[#FFC815]"
              />
            </div>
          )}

          {/* Modalidad RX vs Scaled */}
          <div>
            <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider block mb-1.5">
              Modalidad
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#0A0A0C] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setIsRx(true)}
                className={`py-2 rounded-lg text-xs font-black transition-colors ${
                  isRx ? 'bg-[#FFC815] text-black shadow-md' : 'text-gray-400'
                }`}
              >
                RX (Prescrito)
              </button>
              <button
                type="button"
                onClick={() => setIsRx(false)}
                className={`py-2 rounded-lg text-xs font-black transition-colors ${
                  !isRx ? 'bg-[#FFC815] text-black shadow-md' : 'text-gray-400'
                }`}
              >
                SCALED (Escalado)
              </button>
            </div>
          </div>

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
              Notas del WOD (Estrategia, peso usado)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Partí en series de 10, ritmo constante..."
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
            <span>{saving ? 'Guardando...' : isEdit ? 'Actualizar WOD' : 'Guardar Resultado'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
