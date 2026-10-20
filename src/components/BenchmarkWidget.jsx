import { useState } from 'react';
import { Timer, ChevronDown, ChevronUp, Plus, Edit3, Trash2, Award } from 'lucide-react';

export default function BenchmarkWidget({ group, onEdit, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState(false);

  const { name, records = [], best, count } = group;

  return (
    <div className="rounded-2xl bg-[#1C1C1E] border border-white/5 overflow-hidden shadow-md transition-all">
      {/* Header del Widget */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none tap-bounce hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Timer className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white truncate">{name}</h4>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#292929] text-[#A0A0A5]">
                {count} {count === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <span className="text-[10px] text-[#A0A0A5] block mt-0.5">
              Mejor: {best?.date ? new Date(best.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>

        {/* Lado derecho: Mejor tiempo/reps y acciones */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-base font-black text-white tracking-tight">
                {best?.result}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-[#292929] text-[#FFC815]">
                {best?.discipline?.toUpperCase() || 'RX'}
              </span>
            </div>
          </div>

          {/* Botón rápido "+ Añadir WOD" */}
          <button
            type="button"
            onClick={() => onAdd?.(name)}
            className="p-1.5 rounded-lg bg-[#292929] hover:bg-blue-500 hover:text-white text-blue-400 transition-colors tap-bounce"
            title={`Añadir registro a ${name}`}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Toggle Chevron */}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Historial Expandido */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-white/5 flex flex-col gap-1.5">
          <div className="flex flex-col gap-1.5 mt-1">
            {records.map((r, idx) => {
              const isBest = best && r.id === best.id;
              return (
                <div
                  key={r.id || idx}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                    isBest
                      ? 'bg-[#0A0A0C] border-blue-500/30'
                      : 'bg-[#0A0A0C]/50 border-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-[#A0A0A5]">
                        {new Date(r.date || r.performed_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <Award className="w-2.5 h-2.5" />
                          Mejor
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{r.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-white">
                      {r.result}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-[#292929] text-[#FFC815]">
                      {r.discipline?.toUpperCase() || 'RX'}
                    </span>

                    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(r)}
                        className="p-1 rounded-md text-gray-400 hover:text-white"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar registro de ${name} (${r.result})?`)) {
                            onDelete?.(r.id);
                          }
                        }}
                        className="p-1 rounded-md text-gray-400 hover:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
