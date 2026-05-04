import React, { useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Download, FileText, TrendingUp, Package, CheckCircle,
  BarChart2, Calendar, ChevronLeft, ChevronRight, Activity
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7), year: d.getUTCFullYear() };
};

const getWeekRange = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
};

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '8px',
  fontSize: '0.72rem',
  color: '#fff',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
};

// ── Component ─────────────────────────────────────────────────────────────────
const BusinessReport = ({ orders }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [weeksToShow, setWeeksToShow] = useState(12);

  // All years present in data
  const years = useMemo(() => {
    const ys = new Set(orders.map(o => new Date(o.created_at).getFullYear()));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [orders]);

  // Build weekly dataset
  const weeklyData = useMemo(() => {
    const map = {};

    orders.forEach(o => {
      const createdD = new Date(o.created_at);
      if (createdD.getFullYear() !== selectedYear) return;
      const { week } = getISOWeek(createdD);
      if (!map[week]) map[week] = { week, range: getWeekRange(selectedYear, week), ordersIn: 0, produced: 0, delivered: 0, deliveredOrders: 0, income: 0 };
      map[week].ordersIn += 1;
      map[week].produced += parseInt(o.produced_quantity) || 0;
    });

    // Delivery timing based on dispatch date, fallback to stage_5_entry_at
    orders.forEach(o => {
      const rawDate = o.dispatch_date || o.stage_5_entry_at;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (d.getFullYear() !== selectedYear) return;
      if (o.status !== 'Delivered' && o.status !== 'Partial Delivery') return;
      const { week } = getISOWeek(d);
      if (!map[week]) map[week] = { week, range: getWeekRange(selectedYear, week), ordersIn: 0, produced: 0, delivered: 0, deliveredOrders: 0, income: 0 };
      const dispatched = parseInt(o.handed_to_dispatch_total) || 0;
      const price = parseFloat(o.unit_price) || 0;
      map[week].delivered += dispatched;
      map[week].deliveredOrders += 1;
      map[week].income += dispatched * price;
    });

    return Object.values(map)
      .sort((a, b) => a.week - b.week)
      .slice(-weeksToShow)
      .map(row => ({ ...row, label: `W${row.week}` }));
  }, [orders, selectedYear, weeksToShow]);

  // Annual totals
  const yearlyTotals = useMemo(() => {
    const yearOrders = orders.filter(o => new Date(o.created_at).getFullYear() === selectedYear);
    return {
      orders: yearOrders.length,
      produced: yearOrders.reduce((s, o) => s + (parseInt(o.produced_quantity) || 0), 0),
      delivered: yearOrders.filter(o => o.status === 'Delivered').length,
      income: yearOrders.filter(o => o.status === 'Delivered' || o.status === 'Partial Delivery')
        .reduce((s, o) => s + ((parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0)), 0)
    };
  }, [orders, selectedYear]);

  // ── Excel Export ────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Basil Industries Ltd Management System';
    wb.created = new Date();

    // ── Sheet 1: Weekly Report ──
    const ws = wb.addWorksheet('Weekly Report');
    ws.columns = [
      { width: 12 }, { width: 25 }, { width: 15 }, { width: 22 }, { width: 22 }, { width: 22 }
    ];

    // Main Title
    ws.mergeCells('A1:F1');
    const titleRow = ws.getRow(1);
    titleRow.getCell(1).value = 'BASIL INDUSTRIES LTD — WEEKLY BUSINESS REPORT';
    titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.height = 30;

    // Sub Title
    ws.mergeCells('A2:F2');
    const subTitle = ws.getRow(2);
    subTitle.getCell(1).value = `Year: ${selectedYear}  |  Generated: ${new Date().toLocaleString()}`;
    subTitle.getCell(1).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
    subTitle.getCell(1).alignment = { horizontal: 'center' };
    subTitle.height = 20;

    ws.addRow([]);

    // Headers
    const headerRow = ws.addRow(['WEEK', 'PERIOD', 'ORDERS IN', 'UNITS PRODUCED', 'UNITS DELIVERED', 'INCOME (RWF)']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 25;

    // Data Rows
    weeklyData.forEach(r => {
      const row = ws.addRow([
        `Week ${r.week}`, r.range, r.ordersIn, r.produced, r.delivered, r.income
      ]);
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0 RWF';
      row.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FFDDDDDD' } }, bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }, left: { style: 'thin', color: { argb: 'FFDDDDDD' } }, right: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
        if (colNumber > 2) cell.alignment = { horizontal: 'right' };
        else cell.alignment = { horizontal: 'center' };
      });
    });

    ws.addRow([]);

    // Totals Row
    const totalRow = ws.addRow([
      'TOTAL', `${weeksToShow}-week window`,
      weeklyData.reduce((s, r) => s + r.ordersIn, 0),
      weeklyData.reduce((s, r) => s + r.produced, 0),
      weeklyData.reduce((s, r) => s + r.delivered, 0),
      weeklyData.reduce((s, r) => s + r.income, 0)
    ]);
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: colNumber === 1 ? 'FF10B981' : 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF10B981' } }, bottom: { style: 'medium', color: { argb: 'FF10B981' } } };
      if (colNumber > 2) {
        cell.alignment = { horizontal: 'right' };
        if (colNumber === 6) cell.numFmt = '#,##0 RWF';
        else cell.numFmt = '#,##0';
      } else {
        cell.alignment = { horizontal: 'center' };
      }
    });

    // ── Sheet 2: Raw Order Data ──
    const ws2 = wb.addWorksheet('Order Details');
    ws2.columns = [
      { width: 15 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 20 }
    ];

    const rawHeaders = ['Order ID', 'Client', 'Product', 'Qty Ordered', 'Unit Price', 'Qty Produced', 'Qty Dispatched', 'Status', 'Created At', 'Dispatch Date', 'Income (RWF)'];
    const headerRow2 = ws2.addRow(rawHeaders);
    headerRow2.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: 'center' };
    });

    orders
      .filter(o => new Date(o.created_at).getFullYear() === selectedYear)
      .forEach(o => {
        const row = ws2.addRow([
          o.id, o.client_name, o.product_name,
          parseInt(o.quantity) || 0,
          parseFloat(o.unit_price) || 0,
          parseInt(o.produced_quantity) || 0,
          parseInt(o.handed_to_dispatch_total) || 0,
          o.status,
          new Date(o.created_at).toLocaleDateString(),
          o.dispatch_date ? new Date(o.dispatch_date).toLocaleDateString() : '—',
          ((parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0))
        ]);
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0';
        row.getCell(11).numFmt = '#,##0 RWF';
      });

    // Save File
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Basil_Industry_Weekly_Report_${selectedYear}.xlsx`);
  };

  const printReport = () => window.print();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="inner-content" id="printable-report">

      {/* ── Header ─────────────────────── */}
      <header className="content-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-color)' }} />
            WEEKLY BUSINESS REPORT
          </h1>
          <p>BASIL INDUSTRIES LTD — EXECUTIVE PERFORMANCE INTELLIGENCE</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(+e.target.value)}
            style={{ height: '36px', fontSize: '0.8rem', fontWeight: 800, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Weeks window */}
          <select
            value={weeksToShow}
            onChange={e => setWeeksToShow(+e.target.value)}
            style={{ height: '36px', fontSize: '0.8rem', fontWeight: 800, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}
          >
            <option value={4}>Last 4 weeks</option>
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={26}>Last 26 weeks</option>
            <option value={52}>Full Year</option>
          </select>

          <button className="secondary-btn" onClick={printReport} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} /> PRINT
          </button>
          <button className="primary-btn" onClick={exportExcel} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            <Download size={15} /> EXPORT EXCEL
          </button>
        </div>
      </header>

      {/* ── Annual KPIs ─────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Package size={13} /> ORDERS IN ({selectedYear})</h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{yearlyTotals.orders}</p>
          <p className="stat-trend positive">Total registered</p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Activity size={13} /> UNITS PRODUCED</h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{yearlyTotals.produced.toLocaleString()}</p>
          <p className="stat-trend positive">From production floor</p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={13} /> ORDERS DELIVERED</h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{yearlyTotals.delivered}</p>
          <p className="stat-trend positive">
            {yearlyTotals.orders > 0 ? ((yearlyTotals.delivered / yearlyTotals.orders) * 100).toFixed(1) : 0}% fulfillment
          </p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={13} /> TOTAL INCOME</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900 }}>{yearlyTotals.income.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend positive">Dispatched revenue</p>
        </div>
      </div>

      {/* ── Charts Row 1 ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Orders In vs Delivered (bar) */}
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            WEEKLY ORDER FLOW — CREATED vs DELIVERED
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                labelFormatter={label => {
                  const row = weeklyData.find(r => r.label === label);
                  return row ? `${label} · ${row.range}` : label;
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="ordersIn" name="Orders In" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deliveredOrders" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Income line */}
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            WEEKLY INCOME TREND (RWF)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={weeklyData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} RWF`, 'Income']}
                labelFormatter={label => {
                  const row = weeklyData.find(r => r.label === label);
                  return row ? `${label} · ${row.range}` : label;
                }}
              />
              <Area type="monotone" dataKey="income" fill="url(#incomeGrad)" stroke="none" />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#065f46' }} activeDot={{ r: 6 }} name="Income (RWF)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2 ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Units produced vs delivered */}
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            WEEKLY UNIT PRODUCTION vs DELIVERY
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                labelFormatter={label => {
                  const row = weeklyData.find(r => r.label === label);
                  return row ? `${label} · ${row.range}` : label;
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="produced" name="Units Produced" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" name="Units Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative income line */}
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            CUMULATIVE INCOME GROWTH (RWF)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={weeklyData.map((row, i) => ({
              ...row,
              cumIncome: weeklyData.slice(0, i + 1).reduce((s, r) => s + r.income, 0)
            }))}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} RWF`, 'Cumulative']}
                labelFormatter={label => {
                  const row = weeklyData.find(r => r.label === label);
                  return row ? `${label} · ${row.range}` : label;
                }}
              />
              <Line type="monotone" dataKey="cumIncome" stroke="url(#cumGrad)" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 6 }} name="Cumulative Income" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Weekly Data Table ────────────── */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} />
            WEEKLY DATA TABLE — {selectedYear} ({weeksToShow === 52 ? 'Full Year' : `Last ${weeksToShow} Weeks`})
          </div>
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.62rem' }}>
            {weeklyData.length} WEEKS
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>WEEK</th>
                <th>PERIOD</th>
                <th>ORDERS IN</th>
                <th>UNITS PRODUCED</th>
                <th>UNITS DELIVERED</th>
                <th>DELIVERED ORDERS</th>
                <th>FULFILLMENT</th>
                <th style={{ textAlign: 'right' }}>INCOME (RWF)</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.length > 0 ? weeklyData.map((row) => {
                const rate = row.ordersIn > 0 ? ((row.deliveredOrders / row.ordersIn) * 100).toFixed(0) : null;
                return (
                  <tr key={row.week}>
                    <td style={{ fontWeight: 900, color: 'var(--accent-color)' }}>W{row.week}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.range}</td>
                    <td style={{ fontWeight: 700 }}>{row.ordersIn}</td>
                    <td style={{ color: row.produced > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>
                      {row.produced.toLocaleString()}
                    </td>
                    <td style={{ color: row.delivered > 0 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {row.delivered.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700 }}>{row.deliveredOrders}</td>
                    <td>
                      {rate !== null ? (
                        <span style={{ color: +rate >= 80 ? 'var(--accent-color)' : +rate >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>
                          {rate}%
                        </span>
                      ) : <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: row.income > 0 ? '#fff' : 'var(--text-muted)' }}>
                      {row.income > 0 ? row.income.toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No data available for {selectedYear}.
                  </td>
                </tr>
              )}
              {weeklyData.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--accent-color)', background: 'rgba(16,185,129,0.05)' }}>
                  <td colSpan="2" style={{ fontWeight: 900, color: 'var(--accent-color)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>SUBTOTAL</td>
                  <td style={{ fontWeight: 900 }}>{weeklyData.reduce((s, r) => s + r.ordersIn, 0)}</td>
                  <td style={{ fontWeight: 900, color: '#f59e0b' }}>{weeklyData.reduce((s, r) => s + r.produced, 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 900, color: 'var(--accent-color)' }}>{weeklyData.reduce((s, r) => s + r.delivered, 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 900 }}>{weeklyData.reduce((s, r) => s + r.deliveredOrders, 0)}</td>
                  <td style={{ fontWeight: 900, color: 'var(--accent-color)' }}>
                    {(() => {
                      const tot = weeklyData.reduce((s, r) => s + r.ordersIn, 0);
                      const del = weeklyData.reduce((s, r) => s + r.deliveredOrders, 0);
                      return tot > 0 ? `${((del / tot) * 100).toFixed(1)}%` : '—';
                    })()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                    {weeklyData.reduce((s, r) => s + r.income, 0).toLocaleString()} RWF
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .nav-sidebar, nav, button { display: none !important; }
          body { background: white !important; color: black !important; }
          .stat-card, .table-card { border: 1px solid #ddd !important; background: #fff !important; box-shadow: none !important; }
          #printable-report { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default BusinessReport;
