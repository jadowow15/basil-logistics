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

  // form state
  const [form, setForm] = useState({
    recorded_date:  today(),
    order_id:       '',
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
  const totalWastageKg   = useMemo(() => wastages.reduce((s, w) => s + Number(w.quantity_kg   || 0), 0), [wastages]);
  const totalWastageCost = useMemo(() => wastages.reduce((s, w) => s + Number(w.total_cost    || 0), 0), [wastages]);
  const todayWastageKg   = useMemo(() => wastages.filter(w => w.recorded_date === today()).reduce((s, w) => s + Number(w.quantity_kg || 0), 0), [wastages]);
  const todayCost        = useMemo(() => wastages.filter(w => w.recorded_date === today()).reduce((s, w) => s + Number(w.total_cost  || 0), 0), [wastages]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return wastages.filter(w =>
      !q ||
      (w.material_name || '').toLowerCase().includes(q) ||
      (w.notes         || '').toLowerCase().includes(q) ||
      (w.order_id      || '').toString().includes(q)
    );
  }, [wastages, search]);

  // ── form helpers ──────────────────────────────────────────────────────────
  const openModal = () => {
    setForm({ recorded_date: today(), order_id: '', material_name: '', quantity_kg: '', price_per_kg: '', notes: '' });
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
      material_name:  form.material_name.trim(),
      quantity_kg:    parseFloat(form.quantity_kg),
      price_per_kg:   parseFloat(form.price_per_kg),
      total_cost:     computed_total(),
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

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
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

      {/* ── Search & Table ─────────────────────────────────────────────── */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} /> WASTAGE LEDGER
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
                <th>MATERIAL / WASTE</th>
                <th>LINKED ORDER</th>
                <th>QTY (KG)</th>
                <th>PRICE / KG (RWF)</th>
                <th style={{ color: '#ef4444' }}>TOTAL COST (RWF)</th>
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
                      <td style={{ fontWeight: 700 }}>{w.material_name}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {w.order_id
                          ? <span style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.68rem' }}>#{String(w.order_id).substring(0, 8)}</span>
                          : <span style={{ opacity: 0.35 }}>—</span>
                        }
                      </td>
                      <td style={{ fontWeight: 800, color: '#f59e0b' }}>{Number(w.quantity_kg).toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>{Number(w.price_per_kg).toLocaleString()}</td>
                      <td style={{ fontWeight: 900, color: '#ef4444', textAlign: 'right' }}>{Number(w.total_cost).toLocaleString()}</td>
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
                    <td style={{ fontWeight: 900, color: '#f59e0b' }}>
                      {filtered.reduce((s, w) => s + Number(w.quantity_kg || 0), 0).toLocaleString()} kg
                    </td>
                    <td />
                    <td style={{ fontWeight: 900, color: '#ef4444', textAlign: 'right' }}>
                      {filtered.reduce((s, w) => s + Number(w.total_cost || 0), 0).toLocaleString()} RWF
                    </td>
                    <td colSpan={canDelete ? 3 : 2} />
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

              {/* Linked Production Order (optional) */}
              <div>
                <label className="form-label">Linked Production Order <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <select className="form-input" value={form.order_id}
                  onChange={e => setForm(p => ({ ...p, order_id: e.target.value }))}>
                  <option value="">— Select Production Order —</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      #{o.id.substring(0, 8)} — {o.product_name} ({o.client_name})
                    </option>
                  ))}
                </select>
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
    </div>
  );
};

export default Wastages;
