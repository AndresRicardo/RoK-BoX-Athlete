import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, ShoppingBag, MessageCircle, ChevronDown, UserRound,
} from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  ManageHeader, Chips, Segmented, Button, ErrorBox, Empty, Loading, Money, useAction,
} from '../../components/manage/ui';
import {
  NewDebtSheet, SaleSheet, DebtDetailSheet, DebtRow, debtLabel,
} from '../../components/manage/DebtSheets';
import WhatsAppReminderSheet from '../../components/manage/WhatsAppReminderSheet';

const FILTERS = [
  ['open', 'Con saldo'],
  ['paid', 'Pagadas'],
  ['voided', 'Anuladas'],
  ['all', 'Todas'],
];

const STATUSES = {
  open: ['pending', 'partial'],
  paid: ['paid'],
  voided: ['voided'],
  all: [],
};

const VIEWS = [
  ['person', 'Por persona'],
  ['debt', 'Por deuda'],
];
const VIEW_KEY = 'rokbox.debtsView';

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'debt' ? 'debt' : 'person';
  } catch {
    return 'person';
  }
}

function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Sin almacenamiento: la vista vuelve a "Por persona" al recargar.
  }
}

/** Agrupa las deudas por miembro. Saldo y total excluyen las anuladas. */
function groupByMember(debts) {
  const byMember = new Map();
  for (const d of debts) {
    let g = byMember.get(d.member_id);
    if (!g) {
      g = { memberId: d.member_id, name: d.member_name, debts: [], balance: 0, total: 0, latest: d.created_at };
      byMember.set(d.member_id, g);
    }
    g.debts.push(d);
    if (d.status !== 'voided') {
      g.balance += Number(d.balance || 0);
      g.total += Number(d.total_amount || 0);
    }
    if (d.created_at > g.latest) g.latest = d.created_at;
  }
  return [...byMember.values()].map((g) => ({
    ...g,
    // De la más antigua a la más reciente, como se cobra.
    debts: g.debts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));
}

/** Una persona con todas sus deudas del filtro actual; se despliega al tocarla. */
function PersonGroup({ group, filter, open, onToggle, onSelectDebt, onRemind }) {
  const voidedOnly = group.debts.every((d) => d.status === 'voided');
  // En "Con saldo" se muestra lo que debe; en los demás filtros, el total de las deudas.
  const amount = filter === 'open' ? group.balance
    : voidedOnly ? group.debts.reduce((s, d) => s + Number(d.total_amount || 0), 0)
      : group.total;
  const count = group.debts.length;

  return (
    <div className="rounded-2xl bg-[#1C1C1E] border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left p-3 flex items-center gap-3 tap-bounce"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-black text-white block truncate">{group.name}</span>
          <span className="text-[11px] text-[#A0A0A5] block truncate">
            {count} {count === 1 ? 'deuda' : 'deudas'} · {group.debts.map(debtLabel).join(' · ')}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <Money value={amount} className={`text-sm ${voidedOnly ? 'text-gray-400 line-through' : 'text-white'}`} />
          {filter !== 'open' && group.balance > 0 && (
            <span className="text-[10px] font-bold text-amber-400">Saldo <Money value={group.balance} /></span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {group.debts.map((d) => (
            <DebtRow key={d.id} debt={d} compact onClick={() => onSelectDebt(d)} />
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <Link
              to={`/manage/members/${group.memberId}`}
              className="text-[11px] font-black text-[#FFC815] flex items-center gap-1"
            >
              <UserRound className="w-3.5 h-3.5" /> Ver ficha
            </Link>
            {group.balance > 0 && (
              <button
                type="button"
                onClick={onRemind}
                className="text-[11px] font-black text-[#25D366] flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Recordar por WhatsApp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Debts() {
  const { fetchDebts, loadCatalogs } = useManageStore();
  const [filter, setFilter] = useState('open');
  const [view, setView] = useState(readView);
  const [debts, setDebts] = useState(null);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(null); // 'debt' | 'sale'
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [remindId, setRemindId] = useState(null);
  const { run, error } = useAction();

  const refresh = useCallback(async () => {
    const list = await fetchDebts({ statuses: STATUSES[filter] });
    setDebts(list);
    setSelected((prev) => (prev ? list.find((d) => d.id === prev.id) || null : null));
  }, [fetchDebts, filter]);

  useEffect(() => {
    run(async () => {
      await loadCatalogs();
      await refresh();
    });
  }, [loadCatalogs, refresh, run]);

  const visible = useMemo(() => {
    const q = fold(search.trim());
    if (!debts) return [];
    return q
      ? debts.filter((d) => fold(d.member_name).includes(q) || fold(debtLabel(d)).includes(q))
      : debts;
  }, [debts, search]);

  const groups = useMemo(() => {
    const list = groupByMember(visible);
    // Con saldo: quien más debe primero. En los demás filtros: lo más reciente primero.
    return filter === 'open'
      ? list.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
      : list.sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [visible, filter]);

  const totalOpen = visible
    .filter((d) => ['pending', 'partial'].includes(d.status))
    .reduce((sum, d) => sum + Number(d.balance || 0), 0);

  const changeView = (next) => {
    setView(next);
    saveView(next);
  };

  const toggle = (memberId) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    return next;
  });

  // Al buscar, una sola persona encontrada se muestra desplegada.
  const isOpen = (memberId) => expanded.has(memberId) || (search.trim() !== '' && groups.length === 1);

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader title="Deudas y ventas" />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setSheet('debt')}>
          <Plus className="w-4 h-4" /> Nueva deuda
        </Button>
        <Button variant="secondary" onClick={() => setSheet('sale')}>
          <ShoppingBag className="w-4 h-4" /> Venta de contado
        </Button>
      </div>

      <Link
        to="/manage/debts/reminders"
        className="py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 tap-bounce bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30"
      >
        <MessageCircle className="w-4 h-4" /> Recordar por WhatsApp
      </Link>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o concepto"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1C1C1E] border border-white/5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
        />
      </div>

      <Segmented options={VIEWS} value={view} onChange={changeView} />
      <Chips options={FILTERS} value={filter} onChange={setFilter} />

      {filter === 'open' && debts && (
        <div className="px-4 py-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between gap-3">
          <span className="text-xs text-[#A0A0A5] font-bold">
            Total por cobrar
            <span className="block text-[11px] font-normal">
              {view === 'person' && `${groups.length} ${groups.length === 1 ? 'persona' : 'personas'} · `}
              {visible.length} {visible.length === 1 ? 'deuda' : 'deudas'}
            </span>
          </span>
          <Money value={totalOpen} className="text-lg text-[#FFC815]" />
        </div>
      )}

      <ErrorBox error={error} />

      {!debts ? (
        <Loading>Cargando deudas...</Loading>
      ) : visible.length === 0 ? (
        <Empty title="No hay deudas con este filtro" />
      ) : view === 'person' ? (
        <div className="flex flex-col gap-1.5">
          {groups.map((g) => (
            <PersonGroup
              key={g.memberId}
              group={g}
              filter={filter}
              open={isOpen(g.memberId)}
              onToggle={() => toggle(g.memberId)}
              onSelectDebt={setSelected}
              onRemind={() => setRemindId(g.memberId)}
            />
          ))}
          {debts.length >= 300 && (
            <p className="text-[10px] text-gray-500 text-center">Se muestran las 300 deudas más recientes de este filtro.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((d) => (
            <DebtRow key={d.id} debt={d} onClick={() => setSelected(d)} />
          ))}
        </div>
      )}

      <NewDebtSheet open={sheet === 'debt'} onClose={() => setSheet(null)} onDone={() => run(refresh)} />
      <SaleSheet open={sheet === 'sale'} onClose={() => setSheet(null)} onDone={() => run(refresh)} />
      <DebtDetailSheet
        open={!!selected}
        debt={selected}
        onClose={() => setSelected(null)}
        onChanged={() => run(refresh)}
      />
      <WhatsAppReminderSheet
        open={!!remindId}
        memberId={remindId}
        onClose={() => setRemindId(null)}
      />
    </div>
  );
}
