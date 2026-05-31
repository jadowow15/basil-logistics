import React, { useMemo, useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Download, FileText, TrendingUp, Package, CheckCircle,
  BarChart2, Calendar, Activity, Trash2, DollarSign, TrendingDown, AlertCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

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

const todayStr = () => new Date().toISOString().split('T')[0];

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '8px',
  fontSize: '0.72rem',
  color: '#fff',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
};

// ── View modes ────────────────────────────────────────────────────────────────
const VIEW_MODES = [
  { id: 'daily',   label: 'Daily' },
  { id: 'custom',  label: 'Custom Period' },
  { id: 'weekly',  label: 'Weekly' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const BusinessReport = ({ orders }) => {
  const currentYear = new Date().getFullYear();
  const [viewMode,     setViewMode]     = useState('daily');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [weeksToShow,  setWeeksToShow]  = useState(12);
  const [dailyDate,    setDailyDate]    = useState(todayStr());
  const [rangeStart,   setRangeStart]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [rangeEnd,     setRangeEnd]     = useState(todayStr());

  // wastages & raw materials state
  const [wastages, setWastages] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  useEffect(() => {
    const fetchWastages = async () => {
      const { data } = await supabase.from('wastages').select('*');
      setWastages(data || []);
    };
    const fetchRawMaterials = async () => {
      const { data } = await supabase.from('raw_materials').select('*');
      setRawMaterials(data || []);
    };
    fetchWastages();
    fetchRawMaterials();

    const channelW = supabase.channel('report_wastages_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wastages' }, () => fetchWastages())
      .subscribe();
    const channelR = supabase.channel('report_raw_materials_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, () => fetchRawMaterials())
      .subscribe();

    return () => {
      supabase.removeChannel(channelW);
      supabase.removeChannel(channelR);
    };
  }, []);

  // All years present in data
  const years = useMemo(() => {
    const ys = new Set(orders.filter(o => o.created_at).map(o => new Date(o.created_at).getFullYear()));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [orders]);

  // ── GLOBAL OUTSTANDING DEBT ─────────────────────────────────────────────────
  const totalOutstandingDebt = useMemo(() => {
    return orders.reduce((sum, o) => {
      const isDelivered = o.status === 'Delivered';
      const totalAmount = (parseInt(o.quantity) || 0) * (parseFloat(o.unit_price) || 0);
      const amountPaid = parseFloat(o.amount_paid) || 0;
      if (isDelivered && amountPaid >= totalAmount) return sum;
      return sum + Math.max(0, totalAmount - amountPaid);
    }, 0);
  }, [orders]);

  // ── DAILY MODE ──────────────────────────────────────────────────────────────
  const dailyStats = useMemo(() => {
    const dayOrders = orders.filter(o => {
      const rawDate = o.dispatch_date || o.stage_5_entry_at || o.created_at;
      return rawDate && rawDate.startsWith(dailyDate);
    });
    const createdToday = orders.filter(o => o.created_at && o.created_at.startsWith(dailyDate));
    const deliveredToday = dayOrders.filter(o => o.status === 'Delivered' || o.status === 'Partial Delivery');
    
    const revenue = deliveredToday.reduce((s, o) => s + ((parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0)), 0);
    const wastageSoldRevenue = wastages.filter(w => w.recorded_date === dailyDate).reduce((s, w) => s + Number(w.sold_price || 0), 0);
    const income = revenue + wastageSoldRevenue;

    const rawMaterialsCost = rawMaterials.filter(r => r.recorded_date === dailyDate).reduce((s, r) => s + Number(r.total_cost || 0), 0);
    const expenses = rawMaterialsCost; // expenses = Stock expense

    const wastageCost = wastages
      .filter(w => w.recorded_date === dailyDate)
      .reduce((s, w) => s + Number(w.total_cost || 0), 0);
    const wastageKg = wastages
      .filter(w => w.recorded_date === dailyDate)
      .reduce((s, w) => s + Number(w.quantity_kg || 0), 0);
    const wastageSoldKg = wastages
      .filter(w => w.recorded_date === dailyDate)
      .reduce((s, w) => s + Number(w.quantity_sold_kg || 0), 0);
      
    const netProfit = income - expenses;

    return { createdToday, deliveredToday, revenue, wastageSoldRevenue, income, expenses, wastageCost, wastageKg, wastageSoldKg, netProfit };
  }, [orders, wastages, rawMaterials, dailyDate]);

  // ── CUSTOM PERIOD MODE ───────────────────────────────────────────────────────
  const customStats = useMemo(() => {
    const start = new Date(rangeStart);
    const end   = new Date(rangeEnd);
    end.setHours(23, 59, 59, 999);

    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };

    const periodOrders  = orders.filter(o => inRange(o.created_at));
    const deliveredInRange = orders.filter(o => {
      const d = o.dispatch_date || o.stage_5_entry_at;
      return inRange(d) && (o.status === 'Delivered' || o.status === 'Partial Delivery');
    });
    
    const revenue = deliveredInRange.reduce((s, o) => s + ((parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0)), 0);
    const wastageSoldRevenue = wastages.filter(w => inRange(w.recorded_date)).reduce((s, w) => s + Number(w.sold_price || 0), 0);
    const income = revenue + wastageSoldRevenue;
    
    const expenses = rawMaterials.filter(r => inRange(r.recorded_date)).reduce((s, r) => s + Number(r.total_cost || 0), 0);

    const wastageCost = wastages.filter(w => inRange(w.recorded_date)).reduce((s, w) => s + Number(w.total_cost || 0), 0);
    const wastageKg = wastages.filter(w => inRange(w.recorded_date)).reduce((s, w) => s + Number(w.quantity_kg || 0), 0);
    const wastageSoldKg = wastages.filter(w => inRange(w.recorded_date)).reduce((s, w) => s + Number(w.quantity_sold_kg || 0), 0);

    // Build daily breakdown for chart
    const dayMap = {};
    const initDay = (key) => { if (!dayMap[key]) dayMap[key] = { date: key, income: 0, expenses: 0, wastageCost: 0, wastageKg: 0, wastageSoldKg: 0 }; };

    deliveredInRange.forEach(o => {
      const key = (o.dispatch_date || o.stage_5_entry_at || '').substring(0, 10);
      if (!key) return;
      initDay(key);
      dayMap[key].income += (parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0);
    });

    wastages.filter(w => inRange(w.recorded_date)).forEach(w => {
      const key = w.recorded_date;
      initDay(key);
      dayMap[key].income += Number(w.sold_price || 0);
      dayMap[key].wastageCost += Number(w.total_cost || 0);
      dayMap[key].wastageKg += Number(w.quantity_kg || 0);
      dayMap[key].wastageSoldKg += Number(w.quantity_sold_kg || 0);
    });
    
    rawMaterials.filter(r => inRange(r.recorded_date)).forEach(r => {
      const key = r.recorded_date;
      initDay(key);
      dayMap[key].expenses += Number(r.total_cost || 0);
    });

    const dailyBreakdown = Object.values(dayMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, profit: r.income - r.expenses, label: fmtDate(r.date) }));

    return { periodOrders, deliveredInRange, income, expenses, wastageCost, wastageKg, wastageSoldKg, netProfit: income - expenses, dailyBreakdown };
  }, [orders, wastages, rawMaterials, rangeStart, rangeEnd]);

  // ── WEEKLY MODE ──────────────────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const map = {};
    const initWeek = (week) => {
      if (!map[week]) map[week] = { week, range: getWeekRange(selectedYear, week), ordersIn: 0, produced: 0, delivered: 0, deliveredOrders: 0, income: 0, expenses: 0, wastageCost: 0, wastageKg: 0, wastageSoldKg: 0 };
    };

    orders.forEach(o => {
      if (!o.created_at) return;
      const createdD = new Date(o.created_at);
      if (createdD.getFullYear() !== selectedYear) return;
      const { week } = getISOWeek(createdD);
      initWeek(week);
      map[week].ordersIn += 1;
      map[week].produced += parseInt(o.produced_quantity) || 0;
    });

    orders.forEach(o => {
      const rawDate = o.dispatch_date || o.stage_5_entry_at;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (d.getFullYear() !== selectedYear) return;
      if (o.status !== 'Delivered' && o.status !== 'Partial Delivery') return;
      const { week } = getISOWeek(d);
      initWeek(week);
      const dispatched = parseInt(o.handed_to_dispatch_total) || 0;
      const price = parseFloat(o.unit_price) || 0;
      map[week].delivered += dispatched;
      map[week].deliveredOrders += 1;
      map[week].income += dispatched * price;
    });

    wastages.forEach(w => {
      if (!w.recorded_date) return;
      const d = new Date(w.recorded_date);
      if (d.getFullYear() !== selectedYear) return;
      const { week } = getISOWeek(d);
      initWeek(week);
      map[week].income += Number(w.sold_price || 0);
      map[week].wastageCost += Number(w.total_cost || 0);
      map[week].wastageKg += Number(w.quantity_kg || 0);
      map[week].wastageSoldKg += Number(w.quantity_sold_kg || 0);
    });
    
    rawMaterials.forEach(r => {
      if (!r.recorded_date) return;
      const d = new Date(r.recorded_date);
      if (d.getFullYear() !== selectedYear) return;
      const { week } = getISOWeek(d);
      initWeek(week);
      map[week].expenses += Number(r.total_cost || 0);
    });

    return Object.values(map)
      .sort((a, b) => a.week - b.week)
      .slice(-weeksToShow)
      .map(row => ({ ...row, label: `W${row.week}`, netProfit: row.income - row.expenses }));
  }, [orders, wastages, rawMaterials, selectedYear, weeksToShow]);

  // Annual totals (weekly mode)
  const yearlyTotals = useMemo(() => {
    const yearOrders = orders.filter(o => o.created_at && new Date(o.created_at).getFullYear() === selectedYear);
    const revenue = yearOrders
      .filter(o => o.status === 'Delivered' || o.status === 'Partial Delivery')
      .reduce((s, o) => s + ((parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0)), 0);
      
    const wastageSoldRevenue = wastages.filter(w => w.recorded_date && new Date(w.recorded_date).getFullYear() === selectedYear).reduce((s, w) => s + Number(w.sold_price || 0), 0);
    const income = revenue + wastageSoldRevenue;
    
    const expenses = rawMaterials.filter(r => r.recorded_date && new Date(r.recorded_date).getFullYear() === selectedYear).reduce((s, r) => s + Number(r.total_cost || 0), 0);

    const wastageCost = wastages
      .filter(w => w.recorded_date && new Date(w.recorded_date).getFullYear() === selectedYear)
      .reduce((s, w) => s + Number(w.total_cost || 0), 0);
      
    return {
      orders: yearOrders.length,
      produced: yearOrders.reduce((s, o) => s + (parseInt(o.produced_quantity) || 0), 0),
      delivered: yearOrders.filter(o => o.status === 'Delivered').length,
      income,
      expenses,
      wastageCost,
      netProfit: income - expenses
    };
  }, [orders, wastages, rawMaterials, selectedYear]);

  // ── Excel Export ─────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Basil Industries Ltd Management System';
    wb.created = new Date();

    if (viewMode === 'daily') {
      const ws = wb.addWorksheet('Daily Report');
      ws.columns = [{ width: 30 }, { width: 20 }];
      ws.mergeCells('A1:B1');
      const t = ws.getRow(1); t.getCell(1).value = `BASIL INDUSTRIES LTD — DAILY REPORT: ${dailyDate}`;
      t.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      t.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      t.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; t.height = 28;
      ws.addRow(['Generated', new Date().toLocaleString()]);
      ws.addRow([]);
      const addRow = (label, value, color) => {
        const r = ws.addRow([label, value]);
        r.getCell(1).font = { bold: true }; r.getCell(2).font = { bold: true, color: { argb: color || 'FF000000' } };
      };
      addRow('Orders Created Today', dailyStats.createdToday.length);
      addRow('Orders Delivered Today', dailyStats.deliveredToday.length);
      addRow('Total Income (RWF)', dailyStats.income.toLocaleString(), 'FF10B981');
      addRow('Total expenses (RWF)', dailyStats.expenses.toLocaleString(), 'FFEF4444');
      addRow('Wastage Sold (RWF)', dailyStats.wastageSoldRevenue.toLocaleString(), 'FF10B981');
      addRow('Wastage Cost (RWF)', dailyStats.wastageCost.toLocaleString(), 'FFF59E0B');
      addRow('Wastage (kg)', dailyStats.wastageKg.toLocaleString(), 'FFF59E0B');
      addRow('NET PROFIT (RWF)', dailyStats.netProfit.toLocaleString(), dailyStats.netProfit >= 0 ? 'FF10B981' : 'FFEF4444');

    } else if (viewMode === 'custom') {
      const ws = wb.addWorksheet('Period Report');
      ws.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
      ws.mergeCells('A1:D1');
      const t = ws.getRow(1); t.getCell(1).value = `BASIL INDUSTRIES LTD — PERIOD: ${rangeStart} → ${rangeEnd}`;
      t.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      t.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      t.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; t.height = 28;
      ws.addRow([]);
      const hdr = ws.addRow(['DATE', 'INCOME (RWF)', 'expenses (RWF)', 'WASTAGE COST (RWF)', 'NET PROFIT (RWF)']);
      hdr.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; c.alignment = { horizontal: 'center' }; });
      customStats.dailyBreakdown.forEach(r => {
        const row = ws.addRow([r.date, r.income, r.expenses, r.wastageCost, r.profit]);
        row.getCell(2).numFmt = '#,##0 RWF'; row.getCell(3).numFmt = '#,##0 RWF'; row.getCell(4).numFmt = '#,##0 RWF'; row.getCell(5).numFmt = '#,##0 RWF';
        row.getCell(5).font = { color: { argb: r.profit >= 0 ? 'FF10B981' : 'FFEF4444' } };
      });
      ws.addRow([]);
      const tot = ws.addRow(['TOTAL', customStats.income, customStats.expenses, customStats.wastageCost, customStats.netProfit]);
      tot.eachCell((c, i) => { c.font = { bold: true }; if (i === 5) c.font = { bold: true, color: { argb: customStats.netProfit >= 0 ? 'FF10B981' : 'FFEF4444' } }; });

    } else {
      // Weekly
      const ws = wb.addWorksheet('Weekly Report');
      ws.columns = [{ width: 12 }, { width: 25 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 20 }];
      ws.mergeCells('A1:H1');
      const t = ws.getRow(1); t.getCell(1).value = `BASIL INDUSTRIES LTD — WEEKLY REPORT ${selectedYear}`;
      t.getCell(1).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
      t.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      t.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; t.height = 28;
      ws.addRow([]);
      const hdr = ws.addRow(['WEEK', 'PERIOD', 'ORDERS IN', 'UNITS PRODUCED', 'UNITS DELIVERED', 'INCOME (RWF)', 'expenses (RWF)', 'WASTAGE COST (RWF)', 'NET PROFIT (RWF)']);
      hdr.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
      weeklyData.forEach(r => {
        const row = ws.addRow([`W${r.week}`, r.range, r.ordersIn, r.produced, r.delivered, r.income, r.expenses, r.wastageCost, r.netProfit]);
        [6, 7, 8, 9].forEach(i => { row.getCell(i).numFmt = '#,##0 RWF'; row.getCell(i).alignment = { horizontal: 'right' }; });
        row.getCell(9).font = { color: { argb: r.netProfit >= 0 ? 'FF10B981' : 'FFEF4444' } };
      });
      ws.addRow([]);
      const tot = ws.addRow([
        'TOTAL', `${weeksToShow}-week window`,
        weeklyData.reduce((s, r) => s + r.ordersIn, 0),
        weeklyData.reduce((s, r) => s + r.produced, 0),
        weeklyData.reduce((s, r) => s + r.delivered, 0),
        weeklyData.reduce((s, r) => s + r.income, 0),
        weeklyData.reduce((s, r) => s + r.expenses, 0),
        weeklyData.reduce((s, r) => s + r.wastageCost, 0),
        weeklyData.reduce((s, r) => s + r.netProfit, 0),
      ]);
      tot.eachCell((c, i) => { c.font = { bold: true }; if (i === 9) c.font = { bold: true, color: { argb: yearlyTotals.netProfit >= 0 ? 'FF10B981' : 'FFEF4444' } }; });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const label = viewMode === 'daily' ? dailyDate : viewMode === 'custom' ? `${rangeStart}_to_${rangeEnd}` : `${selectedYear}_weekly`;
    saveAs(blob, `Basil_Industries_Report_${label}.xlsx`);
  };

  const printReport = () => window.print();

  // ── DAILY render ─────────────────────────────────────────────────────────────
  const renderDaily = () => (
    <>
      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Package size={13} /> ORDERS CREATED</h3>
          <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 900 }}>{dailyStats.createdToday.length}</p>
          <p className="stat-trend positive">Today</p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={13} /> ORDERS DELIVERED</h3>
          <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 900 }}>{dailyStats.deliveredToday.length}</p>
          <p className="stat-trend positive">Today</p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Activity size={13} /> UNITS DISPATCHED</h3>
          <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 900 }}>
            {dailyStats.deliveredToday.reduce((s, o) => s + (parseInt(o.handed_to_dispatch_total) || 0), 0).toLocaleString()}
          </p>
          <p className="stat-trend positive">Today</p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><DollarSign size={13} /> TOTAL INCOME</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{dailyStats.income.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend positive">Orders + Sold Wastages</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Trash2 size={13} /> expenses (EXPENSES)</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444' }}>{dailyStats.expenses.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Stock / Materials Purchased</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: `3px solid ${dailyStats.netProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={13} /> NET PROFIT</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: dailyStats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
            {dailyStats.netProfit.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span>
          </p>
          <p className="stat-trend" style={{ color: dailyStats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
            Income − expenses
          </p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ff003c' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={13} /> WASTAGE COST (LOSS)</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff003c' }}>{dailyStats.wastageCost.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#ff003c' }}>{dailyStats.wastageKg.toLocaleString()} kg wasted today</p>
        </div>
      </div>

      {/* Charts for Daily */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            INCOME vs expenses (TODAY)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={[{ label: dailyDate, income: dailyStats.income, expenses: dailyStats.expenses }]} barGap={2} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} RWF`, n]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: '#ff003c', letterSpacing: '0.05em' }}>
            WASTAGE (TODAY)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={[{ label: dailyDate, wastageKg: dailyStats.wastageKg, wastageSoldKg: dailyStats.wastageSoldKg }]} barGap={2} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} kg`, n]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="wastageKg" name="Wasted (kg)" fill="#ff003c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wastageSoldKg" name="Sold (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Orders Table */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} /> ORDERS DELIVERED ON {dailyDate}
          </div>
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.62rem' }}>
            {dailyStats.deliveredToday.length} ORDER(S)
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>CLIENT</th>
                <th>PRODUCT</th>
                <th>UNITS DISPATCHED</th>
                <th>UNIT PRICE (RWF)</th>
                <th style={{ textAlign: 'right' }}>INCOME (RWF)</th>
                <th style={{ textAlign: 'right' }}>OUTSTANDING</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.deliveredToday.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No deliveries on {dailyDate}.</td></tr>
              ) : dailyStats.deliveredToday.map(o => {
                const income = (parseInt(o.handed_to_dispatch_total) || 0) * (parseFloat(o.unit_price) || 0);
                const totalDue = (parseInt(o.quantity) || 0) * (parseFloat(o.unit_price) || 0);
                const paid = parseFloat(o.amount_paid) || 0;
                const outstanding = Math.max(0, totalDue - paid);
                
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>#{o.id?.substring(0, 8)}</td>
                    <td style={{ fontWeight: 700 }}>{o.client_name}</td>
                    <td>{o.product_name}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{(parseInt(o.handed_to_dispatch_total) || 0).toLocaleString()}</td>
                    <td>{(parseFloat(o.unit_price) || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{income.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: outstanding > 0 ? '#ff003c' : 'var(--accent-color)', fontSize: '0.75rem' }}>
                      {outstanding > 0 ? `${outstanding.toLocaleString()} RWF` : '✓ PAID'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ── CUSTOM PERIOD render ──────────────────────────────────────────────────────
  const renderCustom = () => (
    <>
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><DollarSign size={13} /> TOTAL INCOME</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{customStats.income.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend positive">Orders & Wastage Sold</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Trash2 size={13} /> expenses (EXPENSES)</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444' }}>{customStats.expenses.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Stock / Materials Purchased</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: `3px solid ${customStats.netProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={13} /> NET PROFIT</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: customStats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
            {customStats.netProfit.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span>
          </p>
          <p className="stat-trend" style={{ color: customStats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>Income − expenses</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ff003c' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={13} /> WASTAGE COST (LOSS)</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff003c' }}>{customStats.wastageCost.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#ff003c' }}>{customStats.wastageKg.toLocaleString()} kg total waste</p>
        </div>
      </div>

      {/* Charts */}
      {customStats.dailyBreakdown.length > 0 && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="table-card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
              INCOME vs expenses (DAILY)
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={customStats.dailyBreakdown} barGap={2} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} RWF`, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
              NET PROFIT TREND
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={customStats.dailyBreakdown}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} RWF`, 'Net Profit']} />
                <Area type="monotone" dataKey="profit" fill="url(#profitGrad)" stroke="none" />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} name="Net Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="table-card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: '#ff003c', letterSpacing: '0.05em' }}>
              WASTAGE TREND (KG)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customStats.dailyBreakdown} barGap={2} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} kg`, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
                <Bar dataKey="wastageKg" name="Wasted (kg)" fill="#ff003c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wastageSoldKg" name="Sold (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>
      )}

      {/* Period Table */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} /> DAILY BREAKDOWN — {rangeStart} → {rangeEnd}
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th style={{ textAlign: 'right' }}>INCOME (RWF)</th>
                <th style={{ textAlign: 'right', color: '#ef4444' }}>expenses (RWF)</th>
                <th style={{ textAlign: 'right', color: '#f59e0b' }}>WASTAGE COST (RWF)</th>
                <th style={{ textAlign: 'right' }}>NET PROFIT (RWF)</th>
              </tr>
            </thead>
            <tbody>
              {customStats.dailyBreakdown.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No data for selected period.</td></tr>
              ) : (
                <>
                  {customStats.dailyBreakdown.map(r => (
                    <tr key={r.date}>
                      <td style={{ fontWeight: 700 }}>{r.date}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{r.income.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{r.expenses.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>{r.wastageCost.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: r.profit >= 0 ? '#10b981' : '#ef4444' }}>{r.profit.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--accent-color)', background: 'rgba(16,185,129,0.05)' }}>
                    <td style={{ fontWeight: 900, color: 'var(--accent-color)', fontSize: '0.75rem' }}>TOTAL</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#10b981' }}>{customStats.income.toLocaleString()} RWF</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>{customStats.expenses.toLocaleString()} RWF</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#f59e0b' }}>{customStats.wastageCost.toLocaleString()} RWF</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: customStats.netProfit >= 0 ? '#10b981' : '#ef4444', fontSize: '0.9rem' }}>{customStats.netProfit.toLocaleString()} RWF</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ── WEEKLY render (original + wastage columns) ────────────────────────────────
  const renderWeekly = () => (
    <>
      {/* Annual KPIs */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Package size={13} /> ORDERS IN ({selectedYear})</h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{yearlyTotals.orders}</p>
          <p className="stat-trend positive">Total registered</p>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><DollarSign size={13} /> TOTAL INCOME</h3>
          <p className="stat-value" style={{ fontSize: '1.0rem', fontWeight: 900 }}>{yearlyTotals.income.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend positive">Orders + Wastage Sold</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Trash2 size={13} /> expenses (EXPENSES)</h3>
          <p className="stat-value" style={{ fontSize: '1.0rem', fontWeight: 900, color: '#ef4444' }}>{yearlyTotals.expenses.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#ef4444' }}>Raw Materials Purchased</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: `3px solid ${yearlyTotals.netProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={13} /> NET PROFIT</h3>
          <p className="stat-value" style={{ fontSize: '1.0rem', fontWeight: 900, color: yearlyTotals.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
            {yearlyTotals.netProfit.toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span>
          </p>
          <p className="stat-trend" style={{ color: yearlyTotals.netProfit >= 0 ? '#10b981' : '#ef4444' }}>Income − expenses</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
                labelFormatter={label => { const row = weeklyData.find(r => r.label === label); return row ? `${label} · ${row.range}` : label; }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="ordersIn" name="Orders In" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deliveredOrders" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            WEEKLY INCOME vs expenses (RWF)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} RWF`, n]}
                labelFormatter={label => { const row = weeklyData.find(r => r.label === label); return row ? `${label} · ${row.range}` : label; }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
                labelFormatter={label => { const row = weeklyData.find(r => r.label === label); return row ? `${label} · ${row.range}` : label; }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="produced" name="Units Produced" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" name="Units Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
            WEEKLY NET PROFIT TREND (RWF)
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={weeklyData}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} RWF`, 'Net Profit']}
                labelFormatter={label => { const row = weeklyData.find(r => r.label === label); return row ? `${label} · ${row.range}` : label; }}
              />
              <Area type="monotone" dataKey="netProfit" fill="url(#netGrad)" stroke="none" />
              <Line type="monotone" dataKey="netProfit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#065f46' }} activeDot={{ r: 6 }} name="Net Profit (RWF)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="table-card" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', marginBottom: '12px', color: '#ff003c', letterSpacing: '0.05em' }}>
            WEEKLY WASTAGE TREND (KG)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()} kg`, n]}
                labelFormatter={label => { const row = weeklyData.find(r => r.label === label); return row ? `${label} · ${row.range}` : label; }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '8px' }} />
              <Bar dataKey="wastageKg" name="Wasted (kg)" fill="#ff003c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wastageSoldKg" name="Sold (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Data Table */}
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
                <th style={{ textAlign: 'right', color: '#ef4444' }}>expenses (RWF)</th>
                <th style={{ textAlign: 'right', color: '#f59e0b' }}>WASTAGE COST (RWF)</th>
                <th style={{ textAlign: 'right' }}>NET PROFIT (RWF)</th>
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
                    <td style={{ color: row.produced > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>{row.produced.toLocaleString()}</td>
                    <td style={{ color: row.delivered > 0 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 700 }}>{row.delivered.toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{row.deliveredOrders}</td>
                    <td>
                      {rate !== null ? (
                        <span style={{ color: +rate >= 80 ? 'var(--accent-color)' : +rate >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>{rate}%</span>
                      ) : <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: row.income > 0 ? '#fff' : 'var(--text-muted)' }}>
                      {row.income > 0 ? row.income.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: row.expenses > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                      {row.expenses > 0 ? row.expenses.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: row.wastageCost > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {row.wastageCost > 0 ? row.wastageCost.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: row.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                      {row.netProfit.toLocaleString()}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data available for {selectedYear}.</td></tr>
              )}
              {weeklyData.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--accent-color)', background: 'rgba(16,185,129,0.05)' }}>
                  <td colSpan="2" style={{ fontWeight: 900, color: 'var(--accent-color)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>SUBTOTAL</td>
                  <td style={{ fontWeight: 900 }}>{weeklyData.reduce((s, r) => s + r.ordersIn, 0)}</td>
                  <td style={{ fontWeight: 900, color: '#f59e0b' }}>{weeklyData.reduce((s, r) => s + r.produced, 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 900, color: 'var(--accent-color)' }}>{weeklyData.reduce((s, r) => s + r.delivered, 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 900 }}>{weeklyData.reduce((s, r) => s + r.deliveredOrders, 0)}</td>
                  <td style={{ fontWeight: 900, color: 'var(--accent-color)' }}>
                    {(() => { const tot = weeklyData.reduce((s, r) => s + r.ordersIn, 0); const del = weeklyData.reduce((s, r) => s + r.deliveredOrders, 0); return tot > 0 ? `${((del / tot) * 100).toFixed(1)}%` : '—'; })()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900 }}>{weeklyData.reduce((s, r) => s + r.income, 0).toLocaleString()} RWF</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>{weeklyData.reduce((s, r) => s + r.wastageCost, 0).toLocaleString()} RWF</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, color: weeklyData.reduce((s, r) => s + r.netProfit, 0) >= 0 ? '#10b981' : '#ef4444', fontSize: '0.85rem' }}>
                    {weeklyData.reduce((s, r) => s + r.netProfit, 0).toLocaleString()} RWF
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <div className="inner-content printable-report" id="printable-report">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="content-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-color)' }} />
            BUSINESS REPORT
          </h1>
          <p>BASIL INDUSTRIES LTD — EXECUTIVE PERFORMANCE &amp; PROFIT INTELLIGENCE</p>
          
          <div className="print-only-meta" style={{ display: 'none', marginTop: '15px', padding: '10px', border: '1px solid #ccc', background: '#f9f9f9', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#111' }}>
              {viewMode === 'daily' ? 'Daily Report' : viewMode === 'custom' ? 'Custom Period Report' : 'Weekly Report'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#444' }}>
              <strong>Period:</strong> {
                viewMode === 'daily' ? dailyDate :
                viewMode === 'custom' ? `${rangeStart} to ${rangeEnd}` :
                `Last ${weeksToShow} Weeks in ${selectedYear}`
              }
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '3px' }}>
            {VIEW_MODES.map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                style={{
                  height: '30px', padding: '0 12px', borderRadius: '5px', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: viewMode === m.id ? 'var(--accent-color)' : 'transparent',
                  color: viewMode === m.id ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Mode-specific controls */}
          {viewMode === 'daily' && (
            <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
              style={{ height: '36px', fontSize: '0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}
            />
          )}
          {viewMode === 'custom' && (
            <>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                style={{ height: '36px', fontSize: '0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
              <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                style={{ height: '36px', fontSize: '0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}
              />
            </>
          )}
          {viewMode === 'weekly' && (
            <>
              <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 800, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={weeksToShow} onChange={e => setWeeksToShow(+e.target.value)}
                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 800, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', padding: '0 10px' }}>
                <option value={4}>Last 4 weeks</option>
                <option value={8}>Last 8 weeks</option>
                <option value={12}>Last 12 weeks</option>
                <option value={26}>Last 26 weeks</option>
                <option value={52}>Full Year</option>
              </select>
            </>
          )}

          <button className="secondary-btn" onClick={printReport} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} /> PRINT
          </button>
          <button className="primary-btn" onClick={exportExcel} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            <Download size={15} /> EXPORT EXCEL
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {viewMode === 'daily'  && renderDaily()}
      {viewMode === 'custom' && renderCustom()}
      {viewMode === 'weekly' && renderWeekly()}

      {/* Print styles */}
      <style>{`
        @media print {
          .nav-sidebar, nav, .top-header, .bottom-nav, .report-actions, .view-mode-tabs, .report-date-controls { display: none !important; }
          body { background: white !important; color: black !important; }
          .printable-report, .printable-report * { visibility: visible !important; }
          .printable-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; box-sizing: border-box; background: white !important; color: #111 !important; }
          .stat-card { border: 1px solid #ccc !important; background: #f9f9f9 !important; box-shadow: none !important; color: #111 !important; page-break-inside: avoid; }
          .stat-value { color: #111 !important; }
          .stat-label { color: #444 !important; }
          .stat-trend { color: #444 !important; }
          .table-card { border: 1px solid #ccc !important; background: #fff !important; box-shadow: none !important; page-break-inside: avoid; }
          .data-table th { background: #eee !important; color: #111 !important; border: 1px solid #ccc !important; }
          .data-table td { color: #111 !important; border: 1px solid #eee !important; }
          .data-table tr:hover { background: transparent !important; }
          .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .recharts-wrapper, .recharts-surface { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

export default BusinessReport;
