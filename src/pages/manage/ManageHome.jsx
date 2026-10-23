import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Receipt, Inbox, Wallet, Scale, Settings, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import useProfileStore from '../../stores/profileStore';
import useManageStore from '../../stores/manageStore';
import { ManageHeader, ErrorBox, useAction, Money } from '../../components/manage/ui';
import { timeAgo } from '../../utils/time';

const SECTIONS = [
  { to: '/manage/members', label: 'Miembros', desc: 'Renovar, tiquetera y acceso', icon: Users },
  { to: '/manage/debts', label: 'Deudas y ventas', desc: 'Cargos, abonos y ventas de contado', icon: Receipt },
  { to: '/manage/pending', label: 'Pendientes', desc: 'Pagos de HikCentral y vínculos', icon: Inbox, badge: 'pendingCount' },
  { to: '/manage/cash', label: 'Caja', desc: 'Gastos, ingresos y entregas', icon: Wallet, partnerOnly: true },
  { to: '/manage/settlements', label: 'Cuadres', desc: 'Repartir utilidades entre socios', icon: Scale, partnerOnly: true },
  { to: '/manage/settings', label: 'Ajustes', desc: 'Socios, planes, catálogo y roles', icon: Settings, partnerOnly: true },
];

// El bridge envía señal de vida cada pocos minutos; más de 15 sin señal es una alerta.
const BRIDGE_STALE_MS = 15 * 60 * 1000;

function StatTile({ to, label, value, tone = 'text-white' }) {
  return (
    <Link to={to} className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 tap-bounce flex flex-col gap-0.5 min-w-0">
      <span className={`text-xl font-black tabular-nums truncate ${tone}`}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] leading-tight">{label}</span>
    </Link>
  );
}

export default function ManageHome() {
  const { isPartner, roles } = useProfileStore();
  const fetchOverview = useManageStore((state) => state.fetchOverview);
  const [overview, setOverview] = useState(null);
  const { run, error } = useAction();

  useEffect(() => {
    run(async () => setOverview(await fetchOverview({ isPartner })));
  }, [isPartner, fetchOverview, run]);

  const bridge = overview?.bridge;
  const bridgeOnline = bridge?.last_seen_at && Date.now() - new Date(bridge.last_seen_at).getTime() < BRIDGE_STALE_MS;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ManageHeader
        title="Gestión"
        subtitle={isPartner ? 'Socio' : roles.includes('coach') ? 'Coach' : 'Staff'}
        back={null}
      />

      <ErrorBox error={error} />

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          to="/manage/members?status=expiring_soon"
          label="Por vencer"
          value={overview ? overview.expiringSoon : '—'}
          tone="text-amber-400"
        />
        <StatTile
          to="/manage/members?status=overdue"
          label="Vencidas"
          value={overview ? overview.overdue : '—'}
          tone="text-red-400"
        />
        <StatTile
          to="/manage/pending"
          label="Pendientes"
          value={overview ? overview.pendingCount : '—'}
          tone="text-[#FFC815]"
        />
      </div>

      <Link
        to="/manage/debts"
        className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-white/10 flex items-center justify-between tap-bounce"
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] block">Deudas por cobrar</span>
          <Money value={overview?.debtTotal || 0} className="text-2xl text-white" />
          <span className="text-[11px] text-gray-400 block">
            {overview ? `${overview.debtorsCount} ${overview.debtorsCount === 1 ? 'deuda abierta' : 'deudas abiertas'}` : ' '}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500" />
      </Link>

      <Link
        to={isPartner ? '/manage/settings/bridge' : '/manage'}
        className={`px-4 py-3 rounded-2xl border flex items-center gap-3 ${
          !overview
            ? 'bg-[#1C1C1E] border-white/5'
            : bridgeOnline
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        {bridgeOnline ? (
          <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <WifiOff className={`w-5 h-5 shrink-0 ${overview ? 'text-red-400' : 'text-gray-500'}`} />
        )}
        <div className="min-w-0">
          <span className="text-xs font-black text-white block">
            {!overview ? 'HikCentral' : bridgeOnline ? 'HikCentral conectado' : 'HikCentral sin conexión'}
          </span>
          <span className="text-[11px] text-gray-400 block truncate">
            {bridge?.last_seen_at
              ? `Última señal del PC del box ${timeAgo(bridge.last_seen_at)}`
              : overview ? 'El PC del box nunca se ha conectado' : ' '}
          </span>
        </div>
      </Link>

      <div className="flex flex-col gap-2">
        {SECTIONS.filter((s) => isPartner || !s.partnerOnly).map((section) => {
          const Icon = section.icon;
          const badge = section.badge && overview?.[section.badge];
          return (
            <Link
              key={section.to}
              to={section.to}
              className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce"
            >
              <div className="p-2.5 rounded-xl bg-[#FFC815]/10 text-[#FFC815] shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black text-white block">{section.label}</span>
                <span className="text-[11px] text-[#A0A0A5] block truncate">{section.desc}</span>
              </div>
              {badge > 0 && (
                <span className="min-w-6 h-6 px-1.5 rounded-full bg-[#FFC815] text-black text-[11px] font-black flex items-center justify-center">
                  {badge}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
