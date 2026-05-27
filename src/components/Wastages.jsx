import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  Trash2, Plus, Search, AlertTriangle, TrendingDown, DollarSign,
  Scale, X, CheckCircle, RefreshCw, Calendar, ChevronDown, Loader
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().split('T')[0];

// ── Component ─────────────────────────────────────────────────────────────────
const Wastages = ({ profile }) => {
  const [wastages, setWastages]       = useState([]);
  const [orders,   setOrders]         = useState([]);   // for linking to production orders
  const [loading,  setLoading]        = useState(true);
  const [saving,   setSaving]         = useState(false);
  const [search,   setSearch]         = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [deleteId,  setDeleteId]      = useState(null);
  const [sellModal, setSellModal]     = useState(null);
  const [sellPrice, setSellPrice]     = useState('');
  const [sellPricePerKg, setSellPricePerKg] = useState('');
  const [sellQty,   setSellQty]       = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // form state
  const [form, setForm] = useState({
    recorded_date:  today(),
    order_id:       '',
    category:       'Corrugation',
    material_name:  '',
    quantity_kg:    '',
    price_per_kg:   '',
    notes:          '',
  });
  const [formError, setFormError] = useState('');

  // ── fetch data ───────────────────────────────────────────────────────────
  const fetchWastages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wastages')
      .select('*')
      .order('recorded_date', { ascending: false });
    if (!error) setWastages(data || []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, product_name, client_name, workflow_stage')
      .gte('workflow_stage', 2)           // from production onwards
      .order('created_at', { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchWastages();
    fetchOrders();

    // realtime subscription
    const channel = supabase.channel('wastages_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wastages' }, () => {
        fetchWastages();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── computed ─────────────────────────────────────────────────────────────
  const baseFiltered = useMemo(() => {
    if (categoryFilter === 'All') return wastages;
    return wastages.filter(w => w.category === categoryFilter);
  }, [wastages, categoryFilter]);

  const totalWastageKg   = useMemo(() => baseFiltered.reduce((s, w) => s + Number(w.quantity_kg   || 0), 0), [baseFiltered]);
  const totalWastageCost = useMemo(() => baseFiltered.reduce((s, w) => s + Number(w.total_cost    || 0), 0), [baseFiltered]);
  const totalSoldKg      = useMemo(() => baseFiltered.reduce((s, w) => s + Number(w.quantity_sold_kg || 0), 0), [baseFiltered]);
  const totalRemainingKg = useMemo(() => baseFiltered.reduce((s, w) => s + Number((w.quantity_kg || 0) - (w.quantity_sold_kg || 0)), 0), [baseFiltered]);
  const totalRecovered   = useMemo(() => baseFiltered.reduce((s, w) => s + Number(w.sold_price   || 0), 0), [baseFiltered]);
  const netBalance       = useMemo(() => totalWastageCost - totalRecovered, [totalWastageCost, totalRecovered]);
  const fullySoldCount   = useMemo(() => baseFiltered.filter(w => (w.quantity_kg || 0) - (w.quantity_sold_kg || 0) <= 0).length, [baseFiltered]);
  const todayWastageKg   = useMemo(() => baseFiltered.filter(w => w.recorded_date === today()).reduce((s, w) => s + Number(w.quantity_kg || 0), 0), [baseFiltered]);
  const todayCost        = useMemo(() => baseFiltered.filter(w => w.recorded_date === today()).reduce((s, w) => s + Number(w.total_cost  || 0), 0), [baseFiltered]);

  const categoryStats = useMemo(() => {
    const stats = {
      All: { remaining: 0, netBalance: 0, profit: false },
      Corrugation: { remaining: 0, netBalance: 0, profit: false },
      Printing: { remaining: 0, netBalance: 0, profit: false }
    };
    wastages.forEach(w => {
      const remaining = Number((w.quantity_kg || 0) - (w.quantity_sold_kg || 0));
      const cost = Number(w.total_cost || 0);
      const recovered = Number(w.sold_price || 0);
      const net = cost - recovered; // positive is loss, negative is profit

      stats.All.remaining += remaining;
      stats.All.netBalance += net;

      const cat = w.category || 'Corrugation';
      if (stats[cat]) {
         stats[cat].remaining += remaining;
         stats[cat].netBalance += net;
      }
    });

    Object.keys(stats).forEach(k => {
      stats[k].profit = stats[k].netBalance <= 0;
    });

    return stats;
  }, [wastages]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseFiltered.filter(w =>
      !q ||
      (w.material_name || '').toLowerCase().includes(q) ||
      (w.notes         || '').toLowerCase().includes(q) ||
      (w.category      || '').toLowerCase().includes(q) ||
      (w.order_id      || '').toString().includes(q)
    );
  }, [baseFiltered, search]);

  // ── form helpers ──────────────────────────────────────────────────────────
  const openModal = () => {
    setForm({ recorded_date: today(), order_id: '', category: 'Corrugation', material_name: '', quantity_kg: '', price_per_kg: '', notes: '' });
    setFormError('');
    setShowModal(true);
  };

  const computed_total = () => {
    const qty = parseFloat(form.quantity_kg)  || 0;
    const ppk = parseFloat(form.price_per_kg) || 0;
    return qty * ppk;
  };

  const handleSave = async () => {
    // validation
    if (!form.material_name.trim()) { setFormError('Material / waste description is required.'); return; }
    if (!form.quantity_kg || isNaN(parseFloat(form.quantity_kg)) || parseFloat(form.quantity_kg) <= 0) { setFormError('Enter a valid quantity (kg > 0).'); return; }
    if (!form.price_per_kg || isNaN(parseFloat(form.price_per_kg)) || parseFloat(form.price_per_kg) <= 0) { setFormError('Enter a valid price per kg (> 0).'); return; }

    setSaving(true);
    setFormError('');

    const payload = {
      recorded_date:  form.recorded_date || today(),
      order_id:       form.order_id || null,
      category:       form.category,
      material_name:  form.material_name.trim(),
      quantity_kg:    parseFloat(form.quantity_kg),
      price_per_kg:   parseFloat(form.price_per_kg),
      // total_cost is a GENERATED column — database computes it automatically
      notes:          form.notes.trim() || null,
      recorded_by:    profile?.full_name || 'Unknown',
    };

    const { error } = await supabase.from('wastages').insert([payload]);
    setSaving(false);

    if (error) {
      setFormError('Database error: ' + error.message);
      return;
    }

    setShowModal(false);
    fetchWastages();
  };

  const handleDelete = async (id) => {
    await supabase.from('wastages').delete().eq('id', id);
    setDeleteId(null);
    fetchWastages();
  };

  const canManage = ['CEO', 'Admin', 'Production'].includes(profile?.role);
  const canDelete = ['CEO', 'Admin'].includes(profile?.role);
  const canSell   = ['CEO', 'Admin'].includes(profile?.role);

  const handleSell = async () => {
    const qtyToSell = parseFloat(sellQty);
    if (!qtyToSell || isNaN(qtyToSell) || qtyToSell <= 0) {
      alert('Enter a valid Kg amount to sell.');
      return;
    }

    const availableKg = (sellModal.quantity_kg || 0) - (sellModal.quantity_sold_kg || 0);
    if (qtyToSell > availableKg) {
      alert(`You cannot sell more than the remaining balance (${availableKg} kg).`);
      return;
    }

    const price = parseFloat(sellPrice);
    if (!price || isNaN(price) || price <= 0) {
      alert('Enter a valid selling price.');
      return;
    }
    
    setSaving(true);
    
    const newSoldKg = (sellModal.quantity_sold_kg || 0) + qtyToSell;
    const newSoldPrice = (sellModal.sold_price || 0) + price;
    const newStatus = newSoldKg >= sellModal.quantity_kg ? 'Sold' : 'Partially Sold';

    const { error } = await supabase.from('wastages').update({
      status: newStatus,
      quantity_sold_kg: newSoldKg,
      sold_price: newSoldPrice,
      sold_by: profile?.full_name || 'Unknown'
    }).eq('id', sellModal.id);
    
    setSaving(false);
    if (error) {
      alert('Error selling wastage: ' + error.message);
      return;
    }
    setSellModal(null);
    setSellPrice('');
    setSellPricePerKg('');
    setSellQty('');
    fetchWastages();
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="inner-content">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="content-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={22} style={{ color: '#ef4444' }} />
            WASTAGES MANAGEMENT
          </h1>
          <p>BASIL INDUSTRIES LTD — PRODUCTION WASTE TRACKING &amp; COST CONTROL</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="secondary-btn" onClick={fetchWastages} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {canManage && (
            <button className="primary-btn" onClick={openModal} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              <Plus size={15} /> Record Wastage
            </button>
          )}
        </div>
      </header>

      {/* ── KPI Cards Row 1: Wastage Overview ──────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '12px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Scale size={13} /> TOTAL WASTE (ALL TIME)
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{fmt(totalWastageKg)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>kg</span></p>
          <p className="stat-trend" style={{ color: '#ef4444' }}>{wastages.length} entries recorded</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <DollarSign size={13} /> TOTAL WASTAGE COST
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900 }}>{fmt(totalWastageCost)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#ef4444' }}>Cumulative loss</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={13} /> TODAY'S WASTE
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{fmt(todayWastageKg)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>kg</span></p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Current day</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TrendingDown size={13} /> TODAY'S COST
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900 }}>{fmt(todayCost)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Current day impact</p>
        </div>
      </div>

      {/* ── KPI Cards Row 2: Sales Balance ──────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Scale size={13} /> KG SOLD
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{fmt(totalSoldKg)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>kg</span></p>
          <p className="stat-trend" style={{ color: '#10b981' }}>{fullySoldCount} batches fully sold</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Scale size={13} /> KG REMAINING
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b' }}>{fmt(totalRemainingKg)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>kg</span></p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Still available to sell</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <DollarSign size={13} /> TOTAL RECOVERED
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{fmt(totalRecovered)} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: '#10b981' }}>Revenue from waste sales</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: `3px solid ${netBalance > 0 ? '#ef4444' : '#10b981'}` }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TrendingDown size={13} /> NET BALANCE
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900, color: netBalance > 0 ? '#ef4444' : '#10b981' }}>{fmt(Math.abs(netBalance))} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>RWF</span></p>
          <p className="stat-trend" style={{ color: netBalance > 0 ? '#ef4444' : '#10b981' }}>{netBalance > 0 ? 'Net loss after sales' : 'Fully recovered!'}</p>
        </div>
      </div>

      {/* ── Category Performance Summary ──────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {['All', 'Corrugation', 'Printing'].map(cat => {
          const s = categoryStats[cat];
          const isProfit = s.profit;
          return (
            <div key={cat} className="stat-card" style={{ padding: '16px', borderTop: `3px solid ${cat === 'All' ? '#3b82f6' : cat === 'Corrugation' ? '#f59e0b' : '#a855f7'}` }}>
              <h3 className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 900, marginBottom: '12px', color: '#fff', letterSpacing: '0.05em' }}>
                {cat === 'All' ? 'ALL CATEGORIES SUMMARY' : `${cat.toUpperCase()} SUMMARY`}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>REMAINING</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f59e0b' }}>{fmt(s.remaining)} kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>PROFIT / LOSS</span>
                <span style={{ 
                  padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900,
                  background: isProfit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: isProfit ? '#10b981' : '#ef4444',
                  border: `1px solid ${isProfit ? '#10b98140' : '#ef444440'}`
                }}>
                  {isProfit ? 'PROFIT' : 'LOSS'} : {fmt(Math.abs(s.netBalance))} RWF
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search & Table ─────────────────────────────────────────────── */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} /> WASTAGE LEDGER
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setCategoryFilter('All')}
              style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: categoryFilter === 'All' ? 'var(--accent-color)' : 'transparent', color: categoryFilter === 'All' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              ALL CATEGORIES
            </button>
            <button 
              onClick={() => setCategoryFilter('Corrugation')}
              style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: categoryFilter === 'Corrugation' ? '#3b82f6' : 'transparent', color: categoryFilter === 'Corrugation' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              CORRUGATION
            </button>
            <button 
              onClick={() => setCategoryFilter('Printing')}
              style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: categoryFilter === 'Printing' ? '#a855f7' : 'transparent', color: categoryFilter === 'Printing' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              PRINTING
            </button>
          </div>

          <div className="search-bar" style={{ maxWidth: '280px', flex: 1 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search material, notes, order…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>CATEGORY</th>
                <th>MATERIAL / WASTE</th>
                <th>ORIGINAL QTY</th>
                <th>SOLD (KG)</th>
                <th>REMAIN (KG)</th>
                <th>PRICE / KG (RWF)</th>
                <th style={{ color: '#ef4444' }}>TOTAL COST (RWF)</th>
                <th>RECOVERED (RWF)</th>
                <th>SELL</th>
                <th>NOTES</th>
                <th>RECORDED BY</th>
                {canDelete && <th>DEL</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canDelete ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading wastages…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canDelete ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {search ? 'No matching records.' : 'No wastages recorded yet.'}
                </td></tr>
              ) : (
                <>
                  {filtered.map(w => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 700, fontSize: '0.75rem' }}>{w.recorded_date}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                          background: w.category === 'Printing' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                          color: w.category === 'Printing' ? '#a855f7' : '#3b82f6', border: `1px solid ${w.category === 'Printing' ? '#a855f740' : '#3b82f640'}`
                        }}>
                          {w.category || 'Corrugation'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{w.material_name}</td>
                      <td style={{ fontWeight: 800 }}>{Number(w.quantity_kg).toLocaleString()} kg</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>{Number(w.quantity_sold_kg || 0).toLocaleString()} kg</td>
                      <td style={{ fontWeight: 800, color: '#f59e0b' }}>{Number(w.quantity_kg - (w.quantity_sold_kg || 0)).toLocaleString()} kg</td>
                      <td style={{ fontWeight: 700 }}>{Number(w.price_per_kg).toLocaleString()}</td>
                      <td style={{ fontWeight: 900, color: '#ef4444', textAlign: 'right' }}>{Number(w.total_cost).toLocaleString()}</td>
                      <td style={{ fontWeight: 900, color: '#10b981', textAlign: 'right' }}>{Number(w.sold_price || 0).toLocaleString()}</td>
                      <td>
                        {w.quantity_kg - (w.quantity_sold_kg || 0) > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {canSell && (
                              <button onClick={() => { setSellModal(w); setSellPrice(''); setSellPricePerKg(''); setSellQty(''); }} className="primary-btn" style={{ padding: '3px 8px', fontSize: '0.65rem', minHeight: 'auto', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                <DollarSign size={11} style={{ marginRight: '3px' }}/> Sell
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>FULLY SOLD</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.notes || <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.72rem' }}>{w.recorded_by || '—'}</td>
                      {canDelete && (
                        <td>
                          {deleteId === w.id ? (
                            <span style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => handleDelete(w.id)} title="Confirm" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><CheckCircle size={15} /></button>
                              <button onClick={() => setDeleteId(null)} title="Cancel" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={15} /></button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteId(w.id)} title="Delete" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            ><Trash2 size={14} /></button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr style={{ borderTop: '2px solid #ef4444', background: 'rgba(239,68,68,0.06)' }}>
                    <td colSpan="3" style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.75rem', letterSpacing: '0.05em' }}>SUBTOTAL ({filtered.length} entries)</td>
                    <td style={{ fontWeight: 900, color: '#fff' }}>
                      {filtered.reduce((s, w) => s + Number(w.quantity_kg || 0), 0).toLocaleString()} kg
                    </td>
                    <td style={{ fontWeight: 900, color: '#10b981' }}>
                      {filtered.reduce((s, w) => s + Number(w.quantity_sold_kg || 0), 0).toLocaleString()} kg
                    </td>
                    <td style={{ fontWeight: 900, color: '#f59e0b' }}>
                      {filtered.reduce((s, w) => s + Number((w.quantity_kg || 0) - (w.quantity_sold_kg || 0)), 0).toLocaleString()} kg
                    </td>
                    <td />
                    <td style={{ fontWeight: 900, color: '#ef4444', textAlign: 'right' }}>
                      {filtered.reduce((s, w) => s + Number(w.total_cost || 0), 0).toLocaleString()} RWF
                    </td>
                    <td style={{ fontWeight: 900, color: '#10b981', textAlign: 'right' }}>
                      {filtered.reduce((s, w) => s + Number(w.sold_price || 0), 0).toLocaleString()} RWF
                    </td>
                    <td colSpan={canDelete ? 4 : 3} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Record Wastage Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid #ef444433', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> Record Production Wastage
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Date */}
              <div>
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={form.recorded_date}
                  onChange={e => setForm(p => ({ ...p, recorded_date: e.target.value }))} />
              </div>

              {/* Linked Production Order & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Category *</label>
                  <select className="form-input" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    <option value="Corrugation">Corrugation</option>
                    <option value="Printing">Printing</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Linked Order <span style={{ opacity: 0.5 }}>(opt)</span></label>
                  <select className="form-input" value={form.order_id}
                    onChange={e => setForm(p => ({ ...p, order_id: e.target.value }))}>
                    <option value="">— Select Order —</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id.substring(0, 8)} — {o.product_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material / Waste description */}
              <div>
                <label className="form-label">Material / Waste Description *</label>
                <input className="form-input" type="text" placeholder="e.g. Fabric offcuts, Thread waste…"
                  value={form.material_name}
                  onChange={e => setForm(p => ({ ...p, material_name: e.target.value }))} />
              </div>

              {/* Qty + Price per kg */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Quantity (kg) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 12.5"
                    value={form.quantity_kg}
                    onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Price per kg (RWF) *</label>
                  <input className="form-input" type="number" min="0" step="1" placeholder="Enter manually"
                    value={form.price_per_kg}
                    onChange={e => setForm(p => ({ ...p, price_per_kg: e.target.value }))} />
                </div>
              </div>

              {/* Auto-computed total */}
              {computed_total() > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444430', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>TOTAL WASTAGE COST</span>
                  <span style={{ fontWeight: 900, color: '#ef4444', fontSize: '1.05rem' }}>
                    {computed_total().toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>RWF</span>
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="form-label">Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <textarea className="form-input" rows={2} placeholder="Additional context…"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ resize: 'vertical', minHeight: '60px' }}
                />
              </div>

              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '8px 12px', color: '#ef4444', fontSize: '0.78rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button className="secondary-btn" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button className="primary-btn" onClick={handleSave} disabled={saving}
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {saving ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> Save Wastage</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sell Modal ─────────────────────────────────────────────────── */}
      {sellModal && (
        <div className="modal-overlay" onClick={() => setSellModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Sell Wastage Batch</h2>
              <button className="close-btn" onClick={() => setSellModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                <div style={{ marginBottom: '6px' }}><span style={{ color: 'var(--text-muted)' }}>Material:</span> <strong style={{ color: '#fff' }}>{sellModal.material_name}</strong></div>
                <div style={{ marginBottom: '6px' }}><span style={{ color: 'var(--text-muted)' }}>Original Quantity:</span> <strong style={{ color: '#fff' }}>{sellModal.quantity_kg} kg</strong></div>
                <div style={{ marginBottom: '6px' }}><span style={{ color: 'var(--text-muted)' }}>Already Sold:</span> <strong style={{ color: '#10b981' }}>{sellModal.quantity_sold_kg || 0} kg</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Available to Sell:</span> <strong style={{ color: '#f59e0b' }}>{(sellModal.quantity_kg || 0) - (sellModal.quantity_sold_kg || 0)} kg</strong></div>
              </div>

              <div className="form-group">
                <label>Kg to Sell *</label>
                <div className="input-with-icon">
                  <Scale size={16} />
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    max={(sellModal.quantity_kg || 0) - (sellModal.quantity_sold_kg || 0)}
                    placeholder={`Max: ${(sellModal.quantity_kg || 0) - (sellModal.quantity_sold_kg || 0)}`}
                    value={sellQty}
                    onChange={e => {
                      const val = e.target.value;
                      setSellQty(val);
                      const q = parseFloat(val);
                      const ppk = parseFloat(sellPricePerKg);
                      if (!isNaN(q) && !isNaN(ppk)) {
                        setSellPrice(Math.round(q * ppk).toString());
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Price per 1kg (RWF)</label>
                  <div className="input-with-icon">
                    <DollarSign size={16} />
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      value={sellPricePerKg}
                      onChange={e => {
                        const val = e.target.value;
                        setSellPricePerKg(val);
                        const q = parseFloat(sellQty);
                        const ppk = parseFloat(val);
                        if (!isNaN(q) && !isNaN(ppk)) {
                          setSellPrice(Math.round(q * ppk).toString());
                        } else if (val === '') {
                          setSellPrice('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Total Amount (RWF) *</label>
                  <div className="input-with-icon">
                    <DollarSign size={16} />
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5000"
                      value={sellPrice}
                      onChange={e => {
                        const val = e.target.value;
                        setSellPrice(val);
                        const q = parseFloat(sellQty);
                        const tot = parseFloat(val);
                        if (!isNaN(q) && q > 0 && !isNaN(tot)) {
                          setSellPricePerKg((tot / q).toFixed(2).replace(/\.00$/, ''));
                        } else if (val === '') {
                          setSellPricePerKg('');
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <button className="primary-btn" onClick={handleSell} disabled={saving} style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '10px', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {saving ? <Loader size={16} className="spin" style={{ margin: 'auto' }} /> : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Wastages;
