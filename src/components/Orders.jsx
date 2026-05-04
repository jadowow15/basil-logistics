import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, 
  X, 
  Search, 
  User, 
  PenTool, 
  Cpu, 
  Truck, 
  ArrowRight, 
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Paperclip,
  Download,
  FileText,
  Warehouse,
  Edit,
  Trash
} from 'lucide-react';

const Orders = ({ orders, onAddOrder, onUpdateWorkflow, profile }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('queue'); 
  const [statusFilter, setStatusFilter] = useState('All');

  const isExecutive = ['Admin', 'CEO', 'HR'].includes(profile?.role);
  const isReception = profile?.role === 'Reception';
  const currentRoleStage = { 'Reception': 1, 'Design': 2, 'Production': 3, 'Stock': 4, 'Dispatch': 5 }[profile?.role];

  const getStageIndicator = (stageId) => {
    switch (stageId) {
      case 1: return { label: 'Reception', icon: <User size={12} />, color: '#3b82f6' };
      case 2: return { label: 'Design', icon: <PenTool size={12} />, color: '#a855f7' };
      case 3: return { label: 'Machining', icon: <Cpu size={12} />, color: '#eab308' };
      case 4: return { label: 'Warehouse', icon: <Warehouse size={12} />, color: '#10b981' };
      case 5: return { label: 'DELIVERED', icon: <Truck size={12} />, color: '#f59e0b' };
      default: return { label: 'Unknown', icon: <Info size={12} />, color: '#94a3b8' };
    }
  };

  const filteredOrders = orders.filter(order => {
    let isVisibleToRole = false;
    
    if (isExecutive) {
        isVisibleToRole = true;
    } else if (profile?.role === 'Production') {
        const total = parseInt(order.quantity) || 0;
        const produced = parseInt(order.produced_quantity) || 0;
        if (activeFilter === 'queue') {
            isVisibleToRole = (order.workflow_stage === 3) || (order.workflow_stage > 3 && produced < total);
        } else {
            isVisibleToRole = (order.workflow_stage > 3) && produced >= total;
        }
    } else {
        const myBaseStage = isReception ? 1 : currentRoleStage;
        if (activeFilter === 'queue') {
            isVisibleToRole = order.workflow_stage === myBaseStage;
        } else {
            isVisibleToRole = order.workflow_stage > myBaseStage;
        }
    }

    const matchesSearch = 
      (order.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (order.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return isVisibleToRole && matchesSearch;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="inner-content">
      <header className="content-title orders-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>ORDER REPOSITORY</h1>
          <p>INDUSTRIAL FLOW CONTROL UNIT</p>
        </div>
        {(isExecutive || isReception) && (
          <button className="primary-btn" onClick={() => setShowAddModal(true)} style={{ height: '40px', flexShrink: 0 }}>
            <Plus size={16} /> REGISTER NEW ORDER
          </button>
        )}
      </header>

      <div className="table-card">
        <div className="card-header orders-filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1, flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="Filter by client, product..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
          
          {profile?.role && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setActiveFilter('queue')}
                style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: activeFilter === 'queue' ? 'var(--accent-color)' : 'transparent', color: activeFilter === 'queue' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                ACTIVE QUEUE
              </button>
              <button 
                onClick={() => setActiveFilter('archive')}
                style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: activeFilter === 'archive' ? 'var(--accent-color)' : 'transparent', color: activeFilter === 'archive' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                {profile?.role.toUpperCase()} ARCHIVE
              </button>
            </div>
          )}

          <div className="orders-key-legend" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.65rem', marginLeft: 'auto', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap', border: '1px solid transparent' }}>
            VISIBLE: {filteredOrders.length}
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>IDENTIFIER</th>
                <th>ENTITY / SPEC</th>
                <th>TIMELINE</th>
                <th>UNITS</th>
                <th>PHASE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                const stage = getStageIndicator(order.workflow_stage);
                const isNew = order.status === 'Pending' || !order[`${stage.label.toLowerCase().replace(' ', '')}_info`];
                
                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 800, color: 'var(--accent-color)', fontSize: '0.8rem' }}>{order.id}</td>
                    <td>
                      {(() => {
                        const totalQty = parseInt(order.quantity) || 0;
                        const dispatched = parseInt(order.handed_to_dispatch_total) || 0;
                        const remaining = totalQty - dispatched;
                        const isFullyDelivered = dispatched >= totalQty && totalQty > 0;
                        const isPending = order.workflow_stage === 1;
                        return (
                          <>
                            <div style={{ fontWeight: 700, color: isFullyDelivered ? 'var(--accent-color)' : isPending ? 'var(--warning)' : '#fff' }}>
                              {order.client_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: isFullyDelivered ? 'var(--accent-light)' : isPending ? 'rgba(245,158,11,0.7)' : 'var(--text-muted)' }}>
                              {order.product_name}
                            </div>
                            {isFullyDelivered ? (
                              <div style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800, marginTop: '2px' }}>✓ FULFILLED & DELIVERED</div>
                            ) : isPending ? (
                              <div style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800, marginTop: '2px' }}>⚠ PENDING RECEPTION</div>
                            ) : (
                              <div style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800, marginTop: '2px' }}>⏳ {remaining.toLocaleString()} UNITS REMAINING</div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                         <span style={{ fontWeight: 800, color: 'var(--accent-color)', opacity: 0.7 }}>IN:</span>
                         <span>{order[`stage_${order.workflow_stage}_entry_at`] ? new Date(order[`stage_${order.workflow_stage}_entry_at`]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                         <span style={{ fontWeight: 800, color: 'var(--info)', opacity: 0.7 }}>OUT:</span>
                         <span>{order[`stage_${order.workflow_stage}_exit_at`] ? new Date(order[`stage_${order.workflow_stage}_exit_at`]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</span>
                      </div>
                      <div style={{ opacity: 0.4, fontSize: '0.6rem', marginTop: '2px' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    </td>
                    <td style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                      {(() => {
                        const totalQty = parseInt(order.quantity) || 0;
                        const produced = parseInt(order.produced_quantity) || 0;
                        const dispatched = parseInt(order.handed_to_dispatch_total) || 0;
                        const isFullyDelivered = dispatched >= totalQty && totalQty > 0;

                        if (profile?.role === 'Production') {
                          const prodRemaining = totalQty - produced;
                          const isProdComplete = produced >= totalQty;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>DONE</span>
                                <span style={{ color: 'var(--accent-color)', fontWeight: 900 }}>{produced.toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>LEFT</span>
                                <span style={{ color: isProdComplete ? 'var(--accent-color)' : 'var(--warning)', fontWeight: 900 }}>{prodRemaining.toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '2px', marginTop: '2px' }}>
                                <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>TOTAL</span>
                                <span style={{ color: '#fff', fontWeight: 900 }}>{totalQty.toLocaleString()}</span>
                              </div>
                              {isProdComplete && <div style={{ color: 'var(--accent-color)', fontSize: '0.6rem', fontWeight: 800, marginTop: '2px' }}>✓ PRODUCTION COMPLETE</div>}
                            </div>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div>
                              <span style={{ color: 'var(--accent-color)' }}>{dispatched.toLocaleString()}</span>
                              <span style={{ opacity: 0.4, margin: '0 4px' }}>/</span>
                              <span>{totalQty.toLocaleString()}</span>
                            </div>
                            {!isFullyDelivered && (
                              <span style={{ color: 'var(--warning)', fontSize: '0.65rem', marginTop: '4px' }}>
                                REMAINING: {(totalQty - dispatched).toLocaleString()}
                              </span>
                            )}
                            {isFullyDelivered && (
                              <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', marginTop: '4px', fontWeight: 800 }}>
                                ✓ COMPLETE
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: stage.color, fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                          <span style={{ padding: '3px 6px', background: `${stage.color}15`, borderRadius: '4px' }}>{stage.label}</span>
                          <progress value={order.workflow_stage} max="5" style={{ width: '30px' }}></progress>
                       </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="primary-btn" 
                          onClick={() => setShowWorkflowModal(order)}
                          disabled={order.status === 'Delivered'}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '0.7rem', 
                            background: order.status === 'Delivered' ? 'rgba(255,255,255,0.03)' : isNew ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', 
                            color: order.status === 'Delivered' ? 'var(--text-muted)' : isNew ? '#fff' : 'var(--text-muted)',
                            cursor: order.status === 'Delivered' ? 'not-allowed' : 'pointer',
                            opacity: order.status === 'Delivered' ? 0.5 : 1
                          }}
                        >
                           {order.status === 'Delivered' ? 'COMPLETED' : order.workflow_stage === 5 ? 'DELIVERED' : isNew ? 'PROCEED' : 'REVIEW'}
                        </button>
                        {isExecutive && (
                          <>
                            <button className="secondary-btn" title="Modify Order" style={{ padding: '6px' }} onClick={() => setShowModifyModal(order)}><Edit size={14} /></button>
                            <button className="secondary-btn" title="Delete Order" style={{ padding: '6px', color: 'var(--error)' }} onClick={async () => { if(confirm('Delete Order?')) await supabase.from('orders').delete().eq('id', order.id); }}><Trash size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                   <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Department queue is currently empty.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddOrderModal 
          onClose={() => setShowAddModal(false)} 
          onAdd={onAddOrder} 
          profile={profile}
        />
      )}
      {showModifyModal && (
        <ModifyOrderModal 
          order={showModifyModal}
          onClose={() => setShowModifyModal(null)} 
          onSave={(data) => {
            onUpdateWorkflow(showModifyModal.id, showModifyModal.workflow_stage, data);
            setShowModifyModal(null);
          }} 
        />
      )}

      {showWorkflowModal && (
        <WorkflowDetailModal 
          order={showWorkflowModal} 
          onClose={() => setShowWorkflowModal(null)}
          profile={profile}
          onUpdateStage={(stage, data) => {
            onUpdateWorkflow(showWorkflowModal.id, stage, data);
            setShowWorkflowModal(null);
          }}
        />
      )}
    </div>
  );
};

const AddOrderModal = ({ onClose, onAdd, profile }) => {
  const [clients, setClients] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    product_name: '',
    quantity: '',
    unit_price: '',
    expected_delivery_date: '',
    reception_comment: ''
  });

  useEffect(() => {
    const fetchExistingClients = async () => {
        const { data } = await supabase.from('clients').select('name, phone');
        setClients(data || []);
    };
    fetchExistingClients();
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('order-attachments').upload(`reception/${fileName}`, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('order-attachments').getPublicUrl(`reception/${fileName}`);
      setFileUrl(data.publicUrl);
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Automatically register new client if they don't exist
    const clientExists = clients.some(c => c.name.toLowerCase() === formData.client_name.toLowerCase());
    if (!clientExists) {
      await supabase.from('clients').insert([{ 
        name: formData.client_name, 
        phone: formData.client_phone 
      }]);
    }

    const now = new Date().toISOString();
    const newOrder = {
      ...formData,
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Received',
      workflow_stage: 2,
      reception_date: now,
      stage_1_entry_at: now,
      stage_1_exit_at: now,
      stage_2_entry_at: now,
      reception_initiated_by: profile?.full_name,
      reception_attachment_url: fileUrl
    };
    onAdd(newOrder);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header" style={{ padding: '12px 20px' }}>
          <div>
            <h2 style={{ fontSize: '1rem' }}>Order Intake Entry</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Registration and departmental handover.</p>
          </div>
          <button className="secondary-btn" onClick={onClose} style={{ padding: '6px' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div className="form-grid-2" style={{ gap: '20px' }}>
            <div>
               <h3 style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>1. Client</h3>
               <div className="form-group">
                 <label>CLIENT</label>
                 <input required type="text" list="client-list" placeholder="Enterprise" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} />
                 <datalist id="client-list">{clients.map(c => <option key={c.name} value={c.name} />)}</datalist>
               </div>
               <div className="form-group">
                 <label>CONTACT</label>
                 <input required type="text" placeholder="+250..." value={formData.client_phone} onChange={e => setFormData({ ...formData, client_phone: e.target.value })} />
               </div>
               <div className="form-row form-grid-2">
                  <div className="form-group">
                    <label>QTY</label>
                    <input required type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>UNIT PRICE</label>
                    <input required type="number" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} />
                  </div>
               </div>
            </div>
            <div>
               <h3 style={{ fontSize: '0.7rem', color: 'var(--info)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>2. Technical</h3>
               <div className="form-group">
                 <label>SPECIFICATION</label>
                 <input required type="text" placeholder="Product name" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
               </div>
               <div className="form-group">
                 <label>ATTACHMENT</label>
                 <label className="file-upload-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>
                    <Paperclip size={14} color={fileUrl ? 'var(--accent-color)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.7rem' }}>{uploading ? '...' : fileUrl ? 'Attached' : 'Upload PO'}</span>
                    <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e.target.files[0])} />
                 </label>
               </div>
               <div className="form-group">
                 <label>HANDOVER NOTE</label>
                 <textarea rows="2" placeholder="Initial requirements..." value={formData.reception_comment} onChange={e => setFormData({ ...formData, reception_comment: e.target.value })}></textarea>
               </div>
            </div>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '10px 16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
             <div style={{ fontSize: '0.65rem', color: 'var(--info)', fontWeight: 800 }}>INITIATION SCHEDULED</div>
             <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{new Date().toLocaleDateString()} @ {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
             <button type="button" className="secondary-btn" style={{ padding: '6px 12px' }} onClick={onClose}>Abort</button>
             <button type="submit" className="primary-btn" style={{ padding: '6px 16px' }}>INITIALIZE FLOW</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WorkflowDetailModal = ({ order, onClose, onUpdateStage, profile }) => {
  const [activeTab, setActiveTab] = useState(order.workflow_stage);
  const [info, setInfo] = useState('');
  const [comment, setComment] = useState('');
  const isExecutive = ['Admin', 'CEO', 'HR'].includes(profile?.role);

  const stages = [
    { id: 1, label: 'Reception', icon: <User size={16} /> },
    { id: 2, label: 'Design', icon: <PenTool size={16} /> },
    { id: 3, label: 'Production', icon: <Cpu size={16} /> },
    { id: 4, label: 'Stock', icon: <Warehouse size={16} /> },
    { id: 5, label: 'DELIVERED', icon: <Truck size={16} /> }
  ];

  const handleUpdate = () => {
    const prefix = { 2: 'design', 3: 'production', 4: 'stock', 5: 'dispatch' }[activeTab];
    const data = {
      [`${prefix}_info`]: info,
      [`${prefix}_comment`]: comment,
      [`${prefix}_initiated_by`]: profile?.full_name,
      [`${prefix}_date`]: new Date().toISOString(),
      [`stage_${activeTab}_exit_at`]: new Date().toISOString(),
      reception_date: new Date().toISOString(), 
      status: activeTab === 5 ? 'Delivered' : 'In Progress'
    };

    let nextStage = activeTab < 5 ? activeTab + 1 : 5;
    if (activeTab < 5) {
      data[`stage_${activeTab + 1}_entry_at`] = new Date().toISOString();
    }
    if (activeTab === 3) {
      const produced = (order.produced_quantity || 0) + (parseInt(info) || 0);
      data.produced_quantity = produced;
      data.handed_to_stock_total = (order.handed_to_stock_total || 0) + (parseInt(info) || 0);
      if (produced < order.quantity) {
        nextStage = 3;
        data.status = 'Partial';
      }
    }
    onUpdateStage(nextStage, data);
  };

  const currentStageLabel = stages.find(s => s.id === activeTab)?.label;
  const hasAccess = (profile?.role === currentStageLabel) || 
                   (profile?.role === 'Dispatch' && activeTab === 5) ||
                   (profile?.role === 'Stock' && (activeTab === 4 || activeTab === 5)) ||
                   (profile?.role === 'Production' && activeTab === 3);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
        <div className="modal-header" style={{ padding: '10px 16px' }}>
          <div>
             <h2 style={{ fontSize: '0.95rem', fontWeight: 800 }}>STAGE MANAGEMENT: {order.id}</h2>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{order.client_name}</p>
          </div>
          <button className="secondary-btn" onClick={onClose} style={{ padding: '6px' }}><X size={16} /></button>
        </div>
        
        <div className="orders-layout-grid">
           <div className="workflow-stage-sidebar" style={{ background: 'rgba(255,255,255,0.01)', borderRight: '1px solid var(--border-color)', padding: '12px' }}>
              {stages.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => setActiveTab(s.id)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid transparent',
                    background: activeTab === s.id ? 'var(--accent-glow)' : 'transparent',
                    color: activeTab === s.id ? 'var(--accent-color)' : order.workflow_stage >= s.id ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '4px', 
                    background: order.workflow_stage === s.id ? '#3b82f6' : order.workflow_stage > s.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: order.workflow_stage === s.id ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
                  }}>
                    {order.workflow_stage > s.id ? <CheckCircle2 size={12} /> : s.icon }
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem' }}>{s.label}</div>
                  </div>
                </button>
              ))}
           </div>

           <div style={{ padding: '20px' }}>
              {(order.workflow_stage === activeTab && hasAccess) ? (
                <div>
                   <h3 style={{ marginBottom: '16px', fontSize: '0.85rem', fontWeight: 800 }}>PROTOCOL: {currentStageLabel}</h3>
                   
                   {activeTab === 3 && (
                     <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div>
                           <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>ORDER TOTAL</div>
                           <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{order.quantity?.toLocaleString()}</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                        <div>
                           <div style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>PRODUCED</div>
                           <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{order.produced_quantity?.toLocaleString() || 0}</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                        <div>
                           <div style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800 }}>REMAINING</div>
                           <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{(order.quantity - (order.produced_quantity || 0)).toLocaleString()}</div>
                        </div>
                     </div>
                   )}

                   <div className="form-group">
                      <label>{activeTab === 3 ? 'ENTER NEWLY PRODUCED UNITS' : 'DETAILS / SPEC'}</label>
                      <input 
                        type={activeTab === 3 ? 'number' : 'text'} 
                        placeholder="..." 
                        value={info} 
                        onChange={e => setInfo(e.target.value)} 
                        style={{ height: '36px' }}
                      />
                   </div>
                   <div className="form-group">
                      <label>REMARKS</label>
                      <textarea rows="3" placeholder="..." value={comment} onChange={e => setComment(e.target.value)}></textarea>
                   </div>
                   <button className="primary-btn" onClick={handleUpdate} style={{ width: '100%', height: '44px', fontWeight: 800 }}>
                       {activeTab === 4 ? 'CONFIRM DISPATCH' : activeTab === 5 ? 'DELIVERY COMPLETE' : 'AUTHORIZE HANDOVER'}
                   </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                   <Clock size={32} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                   <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>ACCESS RESTRICTED</h3>
                   <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                     Your department is not authorized to finalize this stage.<br/>
                     Current Stage: <span style={{ color: 'var(--accent-color)' }}>{stages.find(s => s.id === order.workflow_stage)?.label}</span>
                   </p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

const ModifyOrderModal = ({ order, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    client_name: order.client_name,
    product_name: order.product_name,
    quantity: order.quantity,
    unit_price: order.unit_price,
    reception_comment: order.reception_comment || '',
    modification_reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      ...formData, 
      last_modified_at: new Date().toISOString() 
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px', width: '90%' }}>
        <div className="modal-header" style={{ padding: '10px 16px' }}>
          <div>
            <h2 style={{ fontSize: '1rem' }}>Modify Order: {order.id}</h2>
          </div>
          <button className="secondary-btn" onClick={onClose} style={{ padding: '6px' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div className="form-group">
            <label>CLIENT NAME</label>
            <input required type="text" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>PRODUCT SPEC</label>
            <input required type="text" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>QUANTITY</label>
              <input required type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
            </div>
            <div className="form-group">
              <label>UNIT PRICE</label>
              <input required type="number" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
             <label>REMARKS (INITIAL)</label>
             <textarea rows="1" value={formData.reception_comment} onChange={e => setFormData({ ...formData, reception_comment: e.target.value })}></textarea>
          </div>
          <div className="form-group">
             <label>REASON FOR MODIFICATION</label>
             <textarea required rows="2" placeholder="Explain why details are being changed..." value={formData.modification_reason} onChange={e => setFormData({ ...formData, modification_reason: e.target.value })}></textarea>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.65rem', color: 'var(--info)', fontWeight: 800, marginBottom: '16px' }}>
             SYSTEM UPDATE: {new Date().toLocaleString()}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
             <button type="button" className="secondary-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
             <button type="submit" className="primary-btn" style={{ flex: 2 }}>SAVE CHANGES</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Orders;
