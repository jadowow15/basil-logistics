import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  X, 
  Edit3, 
  Trash2, 
  Save,
  MessageSquare,
  Building2,
  FileText
} from 'lucide-react';

const Clients = ({ profile }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const canManage = ['CEO', 'Admin', 'Reception', 'HR'].includes(profile?.role);
  const canDelete = ['CEO', 'Admin'].includes(profile?.role);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data || []);
    setLoading(false);
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('clients').insert([formData]);
    if (!error) {
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
      fetchClients();
    }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('clients').update(formData).eq('id', showEditModal.id);
    if (!error) {
       setShowEditModal(null);
       fetchClients();
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`DELETE CLIENT: "${client.name}"?\nThis action cannot be undone.`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (!error) {
      setClients(prev => prev.filter(c => c.id !== client.id));
    } else {
      alert('Delete failed: ' + error.message);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="inner-content">
      <header className="content-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>CLIENT DIRECTORY</h1>
          <p>STRATEGIC PARTNERS</p>
        </div>
        {canManage && (
          <button className="primary-btn" onClick={() => setShowAddModal(true)} style={{ height: '36px' }}>
            <Plus size={16} /> REGISTER CLIENT
          </button>
        )}
      </header>

      <div className="table-card">
        <div className="card-header" style={{ padding: '10px 16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Filter entities..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '32px', fontSize: '0.8rem' }}
            />
          </div>
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.65rem' }}>TOTAL: {clients.length}</div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CLIENT NAME</th>
                <th>CONTACT</th>
                <th>ADDRESS</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? filteredClients.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', color: 'var(--accent-color)' }}>
                        <Building2 size={16} />
                      </div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{c.name}</div>
                    </div>
                  </td>
                  <td>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                        <Mail size={12} style={{ color: 'var(--text-muted)' }} /> {c.email || '—'}
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                        <Phone size={12} /> {c.phone || '—'}
                     </div>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      {canManage && (
                        <button 
                          className="secondary-btn" 
                          onClick={() => {
                            setFormData({ name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
                            setShowEditModal(c);
                          }}
                          style={{ padding: '4px 10px', fontSize: '0.65rem' }}
                        >
                          EDIT
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDeleteClient(c)}
                          style={{ padding: '4px 8px', fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No entities found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>{showAddModal ? 'Register Client' : 'Update Client'}</h2>
              </div>
              <button className="secondary-btn" onClick={() => { setShowAddModal(false); setShowEditModal(null); }} style={{ padding: '4px' }}><X size={16} /></button>
            </div>
            <form onSubmit={showAddModal ? handleAddClient : handleUpdateClient} style={{ padding: '16px' }}>
               <div className="form-group">
                 <label>CLIENT NAME</label>
                 <input required type="text" placeholder="..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="form-grid-2">
                 <div className="form-group">
                   <label>EMAIL</label>
                   <input type="email" placeholder="..." value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                 </div>
                 <div className="form-group">
                   <label>PHONE</label>
                   <input required type="text" placeholder="..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 </div>
               </div>
               <div className="form-group">
                 <label>ADDRESS</label>
                 <input type="text" placeholder="..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
               </div>
               <div className="form-group">
                 <label>REMARKS</label>
                 <textarea rows="2" placeholder="..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
               </div>
               <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button type="button" className="secondary-btn" style={{ flex: 1, height: '36px' }} onClick={() => { setShowAddModal(false); setShowEditModal(null); }}>Abort</button>
                  <button type="submit" className="primary-btn" style={{ flex: 2, height: '36px' }}>SAVE CLIENT</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
