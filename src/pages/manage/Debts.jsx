import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ShoppingBag, MessageCircle } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  ManageHeader, Chips, Button, ErrorBox, Empty, Loading, Money, useAction,
} from '../../components/manage/ui';
import { NewDebtSheet, SaleSheet, DebtDetailSheet, DebtRow } from '../../components/manage/DebtSheets';

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

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Debts() {
  const { fetchDebts, loadCatalogs } = useManageStore();
  const [filter, setFilter] = useState('open');
  const [debts, setDebts] = useState(null);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(null); // 'debt' | 'sale'
  const [selected, setSelected] = useState(null);
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
    return q ? debts.filter((d) => fold(d.member_name).includes(q) || fold(d.concept).includes(q)) : debts;
  }, [debts, search]);

  const totalOpen = visible
    .filter((d) => ['pending', 'partial'].includes(d.status))
    .reduce((sum, d) => sum + Number(d.balance || 0), 0);

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

      <Chips options={FILTERS} value={filter} onChange={setFilter} />

      {filter === 'open' && debts && (
        <div className="px-4 py-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between">
          <span className="text-xs text-[#A0A0A5] font-bold">Total por cobrar ({visible.length})</span>
          <Money value={totalOpen} className="text-lg text-[#FFC815]" />
        </div>
      )}

      <ErrorBox error={error} />

      {!debts ? (
        <Loading>Cargando deudas...</Loading>
      ) : visible.length === 0 ? (
        <Empty title="No hay deudas con este filtro" />
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
    </div>
  );
}
