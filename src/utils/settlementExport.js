// Exportación de un cuadre a PDF y Excel en el navegador, sin servidor (D21).
// Las librerías se cargan solo al exportar para no pesar en el resto de la app.

import { formatCOP, paymentMethodLabel } from './currency';
import { formatDate, formatDateTime, bogotaDate } from './dates';

const fileBase = (s) => `cuadre_${s.period_start}_${s.period_end}`;

const PARTNER_ROWS = [
  ['Ingresos recibidos', 'income_collected'],
  ['Gastos BOX pagados', 'box_expenses_paid'],
  ['Gastos personales', 'personal_expenses'],
  ['Entregado a socios', 'transfers_given'],
  ['Recibido de socios', 'transfers_received'],
  ['Efectivo esperado', 'expected_cash'],
  ['Efectivo declarado', 'declared_cash'],
  ['Diferencia', 'cash_difference'],
  ['Participación', 'gross_share'],
  ['Saldo final', 'net_balance'],
];

export async function exportSettlementPdf(settlement) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const partners = settlement.partners_snapshot || [];
  const transfers = settlement.transfers || [];
  const money = (v) => (v == null ? '—' : formatCOP(v));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RöK BoX · Cuadre de socios', 40, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(settlement.title, 40, 70);
  doc.setTextColor(110);
  doc.text(
    `Periodo: ${formatDate(settlement.period_start, { withYear: true })} a ${formatDate(settlement.period_end, { withYear: true })}`
      + ` · Guardado: ${formatDateTime(settlement.created_at)}`
      + (settlement.is_manual ? ' · Cuadre manual (totales escritos a mano)' : ''),
    40,
    86,
    { maxWidth: 530 },
  );
  doc.setTextColor(0);

  const head = { fillColor: [28, 28, 30], textColor: [255, 200, 21], fontStyle: 'bold' };

  autoTable(doc, {
    startY: 105,
    head: [['Resumen', 'Valor']],
    body: [
      ['Ingresos totales', money(settlement.total_income)],
      ['Gastos del BOX', money(settlement.box_expenses)],
      ['Fondo de reserva', money(settlement.reserve_fund)],
      ['Utilidad a repartir', money(settlement.net_profit)],
    ],
    headStyles: head,
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 10 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [['', ...partners.map((p) => `${p.name} (${Number(p.percentage)} %)`)]],
    body: PARTNER_ROWS.map(([label, key]) => [label, ...partners.map((p) => money(p[key]))]),
    headStyles: head,
    columnStyles: Object.fromEntries(partners.map((_, i) => [i + 1, { halign: 'right' }])),
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [['Transferencias', 'Monto', 'Estado']],
    body: transfers.length
      ? transfers.map((t) => [
          // La fuente estándar del PDF no tiene el carácter de flecha.
          `${t.from_name} -> ${t.to_name}`,
          money(t.amount),
          t.paid_at ? `Pagada ${formatDate(t.paid_at)}` : 'Pendiente',
        ])
      : [['Sin transferencias: las cuentas quedan saldadas.', '', '']],
    headStyles: head,
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 10 },
  });

  if (settlement.notes) {
    doc.setFontSize(10);
    doc.text(`Notas: ${settlement.notes}`, 40, doc.lastAutoTable.finalY + 24, { maxWidth: 530 });
  }

  doc.save(`${fileBase(settlement)}.pdf`);
}

/**
 * Excel con el cuadre y los movimientos del periodo.
 * movements = { incomes, expenses, transfers } y partners/categories para los nombres.
 * En un cuadre manual (movements = null) solo va la hoja del cuadre.
 */
export async function exportSettlementExcel(settlement, { movements, partners, categories }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const partnerName = (id) => partners.find((p) => p.id === id)?.name || '';
  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '';
  const money = { format: '#,##0' };
  const bold = { fontWeight: 'bold' };
  const header = (labels) => labels.map((value) => ({ value, ...bold }));
  const num = (v) => (v == null ? null : { value: Number(v), ...money });
  const day = (ts) => bogotaDate(ts);

  const snapshot = settlement.partners_snapshot || [];

  const summary = [
    [{ value: settlement.title, ...bold }],
    ['Periodo', `${settlement.period_start} a ${settlement.period_end}`],
    ['Tipo', settlement.is_manual ? 'Manual (totales escritos a mano)' : 'Con los movimientos de la app'],
    ['Ingresos totales', num(settlement.total_income)],
    ['Gastos del BOX', num(settlement.box_expenses)],
    ['Fondo de reserva', num(settlement.reserve_fund)],
    ['Utilidad a repartir', num(settlement.net_profit)],
    [null],
    header(['', ...snapshot.map((p) => `${p.name} (${Number(p.percentage)} %)`)]),
    ...PARTNER_ROWS.map(([label, key]) => [label, ...snapshot.map((p) => num(p[key]))]),
    [null],
    header(['Transferencia', 'Monto', 'Estado']),
    ...(settlement.transfers || []).map((t) => [
      `${t.from_name} → ${t.to_name}`,
      num(t.amount),
      t.paid_at ? `Pagada ${day(t.paid_at)}` : 'Pendiente',
    ]),
  ];

  const widths = (...w) => w.map((width) => ({ width }));
  const summarySheet = { sheet: 'Cuadre', data: summary, columns: widths(24, 20, 20, 20, 20) };

  if (!movements) {
    await writeExcelFile([summarySheet]).toFile(`${fileBase(settlement)}.xlsx`);
    return;
  }

  const incomes = [
    header(['Fecha', 'Socio', 'Concepto', 'Origen', 'Medio', 'Monto', 'Nota']),
    ...movements.incomes.map((i) => [
      day(i.received_at), partnerName(i.partner_id), i.concept, i.source,
      paymentMethodLabel(i.payment_method), num(i.amount), i.note || '',
    ]),
  ];

  const expenses = [
    header(['Fecha', 'Socio', 'Descripción', 'Tipo', 'Categoría', 'Medio', 'Monto', 'Nota']),
    ...movements.expenses.map((e) => [
      day(e.spent_at), partnerName(e.partner_id), e.title, e.scope, categoryName(e.category_id),
      paymentMethodLabel(e.payment_method), num(e.amount), e.note || '',
    ]),
  ];

  const transfers = [
    header(['Fecha', 'Entrega', 'Recibe', 'Monto', 'Tipo', 'Nota']),
    ...movements.transfers.map((t) => [
      day(t.transferred_at), partnerName(t.from_partner), partnerName(t.to_partner), num(t.amount),
      t.settlement_id ? 'Pago de cuadre' : 'Entrega', t.note || '',
    ]),
  ];

  await writeExcelFile([
    summarySheet,
    { sheet: 'Ingresos', data: incomes, columns: widths(12, 14, 36, 14, 14, 14, 30) },
    { sheet: 'Gastos', data: expenses, columns: widths(12, 14, 32, 10, 18, 14, 14, 30) },
    { sheet: 'Entregas', data: transfers, columns: widths(12, 14, 14, 14, 16, 30) },
  ]).toFile(`${fileBase(settlement)}.xlsx`);
}
