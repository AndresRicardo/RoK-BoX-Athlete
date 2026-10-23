import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, ChevronRight, Fingerprint, Smartphone } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  ManageHeader, Chips, StatusBadge, ErrorBox, Empty, Loading, Button, useAction,
} from '../../components/manage/ui';
import MemberFormSheet from '../../components/manage/MemberFormSheet';
import { formatDate } from '../../utils/dates';
import { formatCOP } from '../../utils/currency';

const FILTERS = [
  ['all', 'Todos'],
  ['expiring_soon', 'Por vencer'],
  ['overdue', 'Vencidas'],
  ['active', 'Al día'],
  ['no_classes', 'Sin clases'],
  ['disabled', 'Bloqueados'],
  ['no_membership', 'Sin membresía'],
  ['debt', 'Con deuda'],
  ['inactive', 'Inactivos'],
];

// Normaliza para buscar sin tildes ni mayúsculas.
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function membershipLine(m) {
  if (m.status === 'no_membership') return 'Sin plan';
  const until = m.valid_until ? `vence ${formatDate(m.valid_until)}` : '';
  if (m.plan_kind === 'class_pack') {
    return `${m.plan_name || 'Tiquetera'} · ${m.classes_left ?? 0} clases · ${until}`;
  }
  return [m.plan_name, until].filter(Boolean).join(' · ');
}

export default function Members() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { members, membersLoaded, loadingMembers, fetchMembers } = useManageStore();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { run, error } = useAction();
  const filter = searchParams.get('status') || 'all';

  useEffect(() => {
    run(fetchMembers);
  }, [fetchMembers, run]);

  const visible = useMemo(() => {
    const q = fold(search.trim());
    return members.filter((m) => {
      if (filter === 'inactive') {
        if (m.is_active) return false;
      } else {
        if (!m.is_active) return false;
        if (filter === 'debt' && !(Number(m.debt_balance) > 0)) return false;
        if (!['all', 'debt'].includes(filter) && m.status !== filter) return false;
      }
      if (!q) return true;
      return fold(m.full_name).includes(q) || (m.document_id || '').includes(q) || (m.phone || '').includes(q);
    });
  }, [members, search, filter]);

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader
        title="Miembros"
        subtitle={membersLoaded ? `${members.filter((m) => m.is_active).length} activos` : 'Gestión'}
        action={(
          <Button onClick={() => setCreating(true)} className="px-3">
            <UserPlus className="w-4 h-4" />
            <span>Nuevo</span>
          </Button>
        )}
      />

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nombre, cédula o teléfono"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1C1C1E] border border-white/5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
        />
      </div>

      <Chips
        options={FILTERS}
        value={filter}
        onChange={(key) => setSearchParams(key === 'all' ? {} : { status: key }, { replace: true })}
      />

      <ErrorBox error={error} />

      {loadingMembers && !membersLoaded ? (
        <Loading>Cargando miembros...</Loading>
      ) : visible.length === 0 ? (
        <Empty title="No hay miembros con este filtro" />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#A0A0A5] font-bold">{visible.length} resultados</span>
          {visible.map((m) => (
            <Link
              key={m.member_id}
              to={`/manage/members/${m.member_id}`}
              className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white truncate">{m.full_name}</span>
                  {m.profile_id && <Smartphone className="w-3 h-3 text-sky-400 shrink-0" aria-label="Usa la app" />}
                  {!m.hik_person_id && <Fingerprint className="w-3 h-3 text-orange-400 shrink-0" aria-label="No está en HikCentral" />}
                </div>
                <span className="text-[11px] text-[#A0A0A5] block truncate">{membershipLine(m)}</span>
                {Number(m.debt_balance) > 0 && (
                  <span className="text-[11px] text-amber-400 font-bold">
                    Debe {formatCOP(m.debt_balance)}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={m.status} />
                {m.has_pending_payment && <span className="text-[10px] font-bold text-[#FFC815]">Pago pendiente</span>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-500 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-sky-400" /> usa la app</span>
        <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3 text-orange-400" /> falta registrarlo en HikCentral</span>
      </p>

      <MemberFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(member) => {
          fetchMembers();
          navigate(`/manage/members/${member.id}`);
        }}
      />
    </div>
  );
}
