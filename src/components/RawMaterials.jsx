import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import MaterialIssueNote from './MaterialIssueNote';
import {
  Package, Plus, Search, X, CheckCircle, RefreshCw,
  Loader, Trash2, DollarSign, Scale, Calendar, TrendingDown, Clock, UploadCloud, FileText
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().split('T')[0];

const UNITS = ['kg', 'liters', 'rolls', 'sheets', 'pieces', 'boxes', 'bags', 'drums'];

const RawMaterials = ({ profile }) => {
  const isSubmitting            = useRef(false);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  
  const [showIssueModal, setShowIssueModal] = useState(null);
  const [issueData, setIssueData] = useState({ quantity: '', destination: '', purpose: '', receiver: '' });
  const [printIssue, setPrintIssue] = useState(null);
  
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [issueHistory, setIssueHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [uploadProofId, setUploadProofId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);

  const [form, setForm] = useState({
    recorded_date: today(),
    item_name: '',
    supplier: '',
    quantity: '',
    unit: 'kg',
    unit_price: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');

  const fetchItems = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .order('recorded_date', { ascending: false });
    if (!error) setItems(data || []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    const channel = supabase.channel('raw_materials_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, () => fetchItems(true))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── computed ──────────────────────────────────────────────────────────────
  const totalCost    = useMemo(() => items.reduce((s, i) => s + Number(i.total_cost || 0), 0), [items]);
  const todayCost    = useMemo(() => items.filter(i => i.recorded_date === today()).reduce((s, i) => s + Number(i.total_cost || 0), 0), [items]);
  const todayEntries = useMemo(() => items.filter(i => i.recorded_date === today()).length, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i =>
      !q ||
      (i.item_name  || '').toLowerCase().includes(q) ||
      (i.supplier   || '').toLowerCase().includes(q) ||
      (i.notes      || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── form helpers ──────────────────────────────────────────────────────────
  const openModal = () => {
    setForm({ recorded_date: today(), item_name: '', supplier: '', quantity: '', unit: 'kg', unit_price: '', notes: '' });
    setFormError('');
    setShowModal(true);
  };

  const computedTotal = () => (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);

  const handleSave = async () => {
    if (isSubmitting.current) return;
    if (!form.item_name.trim())  { setFormError('Item name is required.'); return; }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setFormError('Enter a valid quantity (> 0).'); return; }
    if (!form.unit_price || parseFloat(form.unit_price) <= 0) { setFormError('Enter a valid unit price (> 0).'); return; }

    isSubmitting.current = true;
    setSaving(true);
    setFormError('');

    const payload = {
      recorded_date: form.recorded_date || today(),
      item_name:     form.item_name.trim(),
      supplier:      form.supplier.trim() || null,
      quantity:      parseFloat(form.quantity),
      unit:          form.unit,
      unit_price:    parseFloat(form.unit_price),
      total_cost:    computedTotal(),
      notes:         form.notes.trim() || null,
      recorded_by:   profile?.full_name || 'Unknown',
    };

    const { error } = await supabase.from('raw_materials').insert([payload]);
    setSaving(false);

    if (error) { 
      setFormError('Database error: ' + error.message); 
      isSubmitting.current = false;
      return; 
    }
    setShowModal(false);
    fetchItems();
    isSubmitting.current = false;
  };

  const handleDelete = async (id) => {
    await supabase.from('raw_materials').delete().eq('id', id);
    setDeleteId(null);
    fetchItems();
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!showIssueModal || isSubmitting.current) return;
    
    const qtyToIssue = parseFloat(issueData.quantity);
    if (!qtyToIssue || qtyToIssue <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }
    
    const maxAllowed = showIssueModal.quantity - (showIssueModal.quantity_used || 0);
    if (qtyToIssue > maxAllowed) {
      alert(`Cannot issue more than available balance (${maxAllowed}).`);
      return;
    }
    
    isSubmitting.current = true;
    setSaving(true);
    const newUsed = (parseFloat(showIssueModal.quantity_used) || 0) + qtyToIssue;
    
    const issuePayload = {
      raw_material_id: showIssueModal.id,
      quantity: qtyToIssue,
      destination: issueData.destination,
      purpose: issueData.purpose,
      issued_by: profile?.full_name || 'Unknown',
      received_by: issueData.receiver,
    };
    
    const { data: insertedIssue, error: issueError } = await supabase
      .from('raw_material_issues')
      .insert([issuePayload])
      .select()
      .single();
      
    if (issueError) {
      alert("Error logging issue: " + issueError.message);
      setSaving(false);
      isSubmitting.current = false;
      return;
    }

    const { error: updateError } = await supabase
      .from('raw_materials')
      .update({ quantity_used: newUsed })
      .eq('id', showIssueModal.id);
      
    setSaving(false);
    if (updateError) {
      alert("Error updating stock balance: " + updateError.message);
      isSubmitting.current = false;
      return;
    }
    
    // Optimistically update the balance in the table immediately
    setItems(prev => prev.map(it =>
      it.id === showIssueModal.id
        ? { ...it, quantity_used: newUsed }
        : it
    ));

    setPrintIssue({
      ...insertedIssue,
      item_name: showIssueModal.item_name,
      unit: showIssueModal.unit
    });
    setTimeout(() => { window.print(); setPrintIssue(null); }, 400);
    
    setShowIssueModal(null);
    fetchItems(true);  // silent background sync
    isSubmitting.current = false;
  };

  const openHistory = async (item) => {
    setShowHistoryModal(item);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('raw_material_issues')
      .select('*')
      .eq('raw_material_id', item.id)
      .order('issued_date', { ascending: false });
    if (!error) setIssueHistory(data || []);
    setHistoryLoading(false);
  };
  
  const handleUploadProof = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadProofId) return;
    
    setSaving(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `rmi-${uploadProofId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('delivery_proofs')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('delivery_proofs')
        .getPublicUrl(fileName);

      await supabase
        .from('raw_material_issues')
        .update({ proof_url: publicUrlData.publicUrl })
        .eq('id', uploadProofId);
      
      alert('Proof of issue uploaded successfully!');
      setUploadProofId(null);
      setUploadFile(null);
      
      if (showHistoryModal) openHistory(showHistoryModal);
    } catch (err) {
      console.error(err);
      alert('Failed to upload proof: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const canManage = ['CEO', 'Admin', 'Stock', 'Production'].includes(profile?.role);
  const canDelete = ['CEO', 'Admin'].includes(profile?.role);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {printIssue && <MaterialIssueNote issueRecord={printIssue} />}

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Package size={13} /> TOTAL ENTRIES
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{items.length}</p>
          <p className="stat-trend" style={{ color: '#10b981' }}>All time records</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #10b981' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <DollarSign size={13} /> TOTAL SPEND (RWF)
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900 }}>{fmt(totalCost)}</p>
          <p className="stat-trend" style={{ color: '#10b981' }}>Cumulative cost</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={13} /> TODAY'S ENTRIES
          </h3>
          <p className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{todayEntries}</p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Current day</p>
        </div>
        <div className="stat-card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <h3 className="stat-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TrendingDown size={13} /> TODAY'S SPEND
          </h3>
          <p className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 900 }}>{fmt(todayCost)}</p>
          <p className="stat-trend" style={{ color: '#f59e0b' }}>Current day spend</p>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={14} /> RAW MATERIALS LEDGER
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ maxWidth: '260px' }}>
              <Search size={14} />
              <input type="text" placeholder="Search item, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="secondary-btn" onClick={fetchItems} style={{ height: '32px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            {canManage && (
              <button className="primary-btn" onClick={openModal} style={{ height: '32px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <Plus size={14} /> Add Material
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>ITEM NAME</th>
                <th>SUPPLIER</th>
                <th>RECEIVED</th>
                <th>USED</th>
                <th>BALANCE</th>
                <th style={{ color: '#10b981' }}>TOTAL COST (RWF)</th>
                <th>NOTES</th>
                <th>COMMANDS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canDelete ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canDelete ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {search ? 'No matching records.' : 'No raw materials recorded yet.'}
                </td></tr>
              ) : (
                <>
                  {filtered.map(item => {
                    const received = parseFloat(item.quantity) || 0;
                    const used = parseFloat(item.quantity_used) || 0;
                    const balance = received - used;
                    
                    return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, fontSize: '0.75rem' }}>{item.recorded_date}</td>
                      <td style={{ fontWeight: 700 }}>{item.item_name}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.supplier || <span style={{ opacity: 0.3 }}>—</span>}</td>
                      <td style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{received.toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{item.unit}</span></td>
                      <td style={{ fontWeight: 800, color: '#f59e0b' }}>{used > 0 ? used.toLocaleString() : '—'}</td>
                      <td style={{ fontWeight: 800, color: balance > 0 ? '#10b981' : 'var(--text-muted)' }}>{balance.toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{item.unit}</span></td>
                      <td style={{ fontWeight: 900, color: '#10b981', textAlign: 'right' }}>{Number(item.total_cost).toLocaleString()}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.notes || <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            className="secondary-btn" 
                            onClick={() => openHistory(item)}
                            style={{ padding: '4px 8px', fontSize: '0.65rem', height: 'auto' }}
                            title="View Issue History"
                          >
                            <Clock size={12} />
                          </button>
                          {balance > 0 && canManage && (
                            <button 
                              className="secondary-btn" 
                              onClick={() => { setShowIssueModal(item); setIssueData({ quantity: balance, destination: '', purpose: '', receiver: '' }); }}
                              style={{ padding: '4px 8px', fontSize: '0.65rem', height: 'auto', borderColor: '#10b981', color: '#10b981' }}
                            >
                              ISSUE
                            </button>
                          )}
                          {canDelete && (
                            deleteId === item.id ? (
                              <span style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><CheckCircle size={15} /></button>
                                <button onClick={() => setDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={15} /></button>
                              </span>
                            ) : (
                              <button onClick={() => setDeleteId(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              ><Trash2 size={14} /></button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                  {/* Totals row */}
                  <tr style={{ borderTop: '2px solid #10b981', background: 'rgba(16,185,129,0.06)' }}>
                    <td colSpan="6" style={{ fontWeight: 900, color: '#10b981', fontSize: '0.75rem' }}>SUBTOTAL ({filtered.length} entries)</td>
                    <td style={{ fontWeight: 900, color: '#10b981', textAlign: 'right' }}>
                      {filtered.reduce((s, i) => s + Number(i.total_cost || 0), 0).toLocaleString()} RWF
                    </td>
                    <td colSpan="2" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Issue to Production Modal ────────────────────────────────────── */}
      {showIssueModal && (
        <div className="modal-overlay" onClick={() => setShowIssueModal(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={18} color="#f59e0b" /> Issue to Production
              </h3>
              <button className="modal-close" onClick={() => setShowIssueModal(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                <div><strong>Item:</strong> {showIssueModal.item_name}</div>
                <div style={{ marginTop: '4px', color: '#10b981' }}>
                  <strong>Available Balance:</strong> {(parseFloat(showIssueModal.quantity) - parseFloat(showIssueModal.quantity_used || 0)).toLocaleString()} {showIssueModal.unit}
                </div>
              </div>
              
              <div>
                <label className="form-label">Quantity to Issue ({showIssueModal.unit}) *</label>
                <input 
                  required
                  className="form-input" 
                  type="number" 
                  min="0.01" 
                  step="0.01"
                  max={parseFloat(showIssueModal.quantity) - parseFloat(showIssueModal.quantity_used || 0)}
                  value={issueData.quantity}
                  onChange={e => setIssueData({ ...issueData, quantity: e.target.value })} 
                />
              </div>

              <div>
                <label className="form-label">Destination (e.g. Corrugation, Flexo) *</label>
                <input 
                  required
                  className="form-input" 
                  type="text" 
                  value={issueData.destination}
                  onChange={e => setIssueData({ ...issueData, destination: e.target.value })} 
                />
              </div>

              <div>
                <label className="form-label">Receiver Name *</label>
                <input 
                  required
                  className="form-input" 
                  type="text" 
                  value={issueData.receiver}
                  onChange={e => setIssueData({ ...issueData, receiver: e.target.value })} 
                />
              </div>

              <div>
                <label className="form-label">Purpose / Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input 
                  className="form-input" 
                  type="text" 
                  value={issueData.purpose}
                  onChange={e => setIssueData({ ...issueData, purpose: e.target.value })} 
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowIssueModal(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Issue History Modal ──────────────────────────────────────────── */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(null)}>
          <div className="modal-content" style={{ maxWidth: '700px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} /> Issue History: {showHistoryModal.item_name}
              </h3>
              <button className="modal-close" onClick={() => setShowHistoryModal(null)}><X size={18} /></button>
            </div>
            
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>QTY</th>
                    <th>DESTINATION</th>
                    <th>RECEIVER</th>
                    <th>ISSUER</th>
                    <th style={{ textAlign: 'right' }}>PROOF</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</td></tr>
                  ) : issueHistory.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No issues recorded for this material.</td></tr>
                  ) : issueHistory.map(hist => (
                    <tr key={hist.id}>
                      <td style={{ fontSize: '0.75rem', fontWeight: 700 }}>{new Date(hist.issued_date).toLocaleString()}</td>
                      <td style={{ fontWeight: 800, color: '#f59e0b' }}>{Number(hist.quantity).toLocaleString()}</td>
                      <td>{hist.destination}</td>
                      <td>{hist.received_by}</td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hist.issued_by}</td>
                      <td style={{ textAlign: 'right' }}>
                        {hist.proof_url ? (
                          <a href={hist.proof_url} target="_blank" rel="noreferrer" className="secondary-btn" style={{ padding: '4px 8px', color: 'var(--accent-color)', display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '0.65rem' }}>
                            <FileText size={12} /> VIEW PROOF
                          </a>
                        ) : (
                          <button className="secondary-btn" onClick={() => setUploadProofId(hist.id)} style={{ padding: '4px 8px', display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '0.65rem' }}>
                            <UploadCloud size={12} /> UPLOAD
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* ── Upload Proof Modal ──────────────────────────────────────────── */}
      {uploadProofId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>Upload Proof of Issue</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Signed Waybill</p>
              </div>
              <button className="secondary-btn" onClick={() => setUploadProofId(null)} style={{ padding: '4px' }}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleUploadProof} style={{ padding: '16px' }}>
              <div className="form-group">
                <label>SIGNED NOTE (PDF/IMAGE)</label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => setUploadProofId(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Uploading...' : 'UPLOAD PROOF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Material Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid #10b98133', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} /> Add Raw Material Entry
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

              {/* Item name */}
              <div>
                <label className="form-label">Item Name *</label>
                <input className="form-input" type="text" placeholder="e.g. Paper rolls, Ink, Glue…"
                  value={form.item_name}
                  onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
              </div>

              {/* Supplier */}
              <div>
                <label className="form-label">Supplier <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input className="form-input" type="text" placeholder="Supplier name"
                  value={form.supplier}
                  onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} />
              </div>

              {/* Qty + Unit + Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 50"
                    value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Unit Price (RWF) *</label>
                  <input className="form-input" type="number" min="0" step="1" placeholder="Price"
                    value={form.unit_price}
                    onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} />
                </div>
              </div>

              {/* Auto-computed total */}
              {computedTotal() > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #10b98130', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>TOTAL COST</span>
                  <span style={{ fontWeight: 900, color: '#10b981', fontSize: '1.05rem' }}>
                    {computedTotal().toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>RWF</span>
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
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {saving ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> Save Entry</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawMaterials;
