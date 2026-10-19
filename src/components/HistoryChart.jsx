import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, Award } from 'lucide-react';

export default function HistoryChart({ prs = [] }) {
  // Obtener lista única de movimientos registrados
  const availableMovements = useMemo(() => {
    const set = new Set(prs.map((p) => p.movement));
    return Array.from(set).sort();
  }, [prs]);

  const [selectedMovement, setSelectedMovement] = useState(
    availableMovements[0] || 'Back Squat'
  );

  // Filtrar y ordenar datos cronológicamente
  const chartData = useMemo(() => {
    return prs
      .filter((p) => p.movement === selectedMovement)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((p) => ({
        date: new Date(p.date).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
        }),
        value: Number(p.value),
        unit: p.unit || 'kg',
      }));
  }, [prs, selectedMovement]);

  // Métricas de progreso
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((d) => d.value);
    const max = Math.max(...values);
    const initial = values[0];
    const diff = max - initial;
    const percent = initial > 0 ? ((diff / initial) * 100).toFixed(1) : 0;
    const unit = chartData[0]?.unit || 'kg';

    return { max, initial, diff, percent, unit };
  }, [chartData]);

  if (availableMovements.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
        Registra tu primer PR para ver tu evolución gráfica aquí.
      </div>
    );
  }

  return (
    <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-4">
      {/* Selector de Movimiento */}
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider shrink-0">
          Movimiento
        </label>
        <select
          value={selectedMovement}
          onChange={(e) => setSelectedMovement(e.target.value)}
          className="flex-1 max-w-[220px] px-3 py-1.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
        >
          {availableMovements.map((mov) => (
            <option key={mov} value={mov} className="bg-[#1C1C1E]">
              {mov}
            </option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FFC815]/15 text-[#FFC815]">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#A0A0A5] block">
                Récord Máximo
              </span>
              <span className="text-base font-black text-white">
                {stats.max} {stats.unit}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#A0A0A5] block">
                Progreso
              </span>
              <span className="text-base font-black text-emerald-400">
                +{stats.diff} {stats.unit} ({stats.percent}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica Recharts */}
      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292929" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#585858"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#292929' }}
            />
            <YAxis
              stroke="#585858"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#292929' }}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="p-2.5 rounded-xl bg-[#1C1C1E] border border-[#FFC815]/30 shadow-xl text-center">
                      <span className="text-[10px] text-gray-400 block">{data.date}</span>
                      <span className="text-sm font-black text-[#FFC815]">
                        {data.value} {data.unit}
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#FFC815"
              strokeWidth={3}
              dot={{ fill: '#FFC815', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#FFC815', strokeWidth: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
