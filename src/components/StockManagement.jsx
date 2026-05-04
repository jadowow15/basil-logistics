import React, { useState } from 'react';
import { 
  ClipboardList, 
  Search, 
  Truck, 
  Archive, 
  CheckCircle2, 
  X,
  Plus
} from 'lucide-react';

const StockManagement = ({ profile, orders, onUpdateWorkflow }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('queue');
  const [showDispatchModal, setShowDispatchModal] = useState(null);
  const [dispatchData, setDispatchData] = useState({
    quantity: '',
    truck: '',
    driver: '',
    driver_phone: '',
    notes: ''
  });
  
  const totalInWarehouse = (orders || []).reduce((acc, o) => acc + ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)), 0);
  
  const filteredOrders = (orders || []).filter(order => {
    const hasEverBeenInStock = (order.handed_to_stock_total || 0) > 0;
    const hasBalance = (order.handed_to_stock_total || 0) > (order.handed_to_dispatch_total || 0);
    const matchesSearch = (order.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (order.product_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'queue') {
      return hasBalance && order.status !== 'Delivered' && matchesSearch;
    } else {
      return hasEverBeenInStock && matchesSearch;
    }
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="inner-content">
      <header className="content-title">
        <h1>LOGISTICS LEDGER</h1>
        <p>WAREHOUSE INVENTORY & FLEET CONTROL</p>
      </header>

      <div className="stats-grid" style={{ marginBottom: '16px', gap: '12px' }}>
        <div className="stat-card" style={{ padding: '12px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.65rem' }}>Warehouse Balance</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>{totalInWarehouse.toLocaleString()}</p>
        </div>
        <div className="stat-card" style={{ padding: '12px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.65rem' }}>Active Dispatches</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>{orders.filter(o => o.workflow_stage === 5).length}</p>
        </div>
        <div className="stat-card" style={{ padding: '12px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.65rem' }}>System Health</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>94%</p>
        </div>
        <div className="stat-card" style={{ padding: '12px' }}>
          <h3 className="stat-label" style={{ fontSize: '0.65rem' }}>Fulfillment Queue</h3>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>{orders.filter(o => o.workflow_stage === 4).length}</p>
        </div>
      </div>

      <div className="table-card">
        <div className="card-header" style={{ padding: '8px 12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Filter ledger..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '28px', fontSize: '0.75rem' }}
            />
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveFilter('queue')}
              style={{ padding: '3px 10px', fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: activeFilter === 'queue' ? 'var(--accent-color)' : 'transparent', color: activeFilter === 'queue' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              ACTIVE QUEUE
            </button>
            <button
              onClick={() => setActiveFilter('archive')}
              style={{ padding: '3px 10px', fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', border: 'none', background: activeFilter === 'archive' ? 'var(--accent-color)' : 'transparent', color: activeFilter === 'archive' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              STOCK ARCHIVE
            </button>
          </div>
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.62rem', marginLeft: 'auto' }}>
            {filteredOrders.length} RECORD{filteredOrders.length !== 1 ? 'S' : ''}
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr style={{ fontSize: '0.7rem' }}>
                <th>CLIENT / ENTITY</th>
                <th>REGISTERED</th>
                <th>IN STOCK</th>
                <th>FULFILLED</th>
                <th style={{ textAlign: 'right' }}>COMMAND</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? filteredOrders.map(order => {
                const balance = (order.handed_to_stock_total || 0) - (order.handed_to_dispatch_total || 0);
                return (
                  <tr key={order.id}>
                    <td>
                       <div style={{ fontWeight: 700, fontSize: '0.8rem', color: order.status === 'Delivered' ? 'var(--accent-color)' : '#fff' }}>{order.client_name}</div>
                       <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{order.product_name}</div>
                       {order.status === 'Delivered' && <div style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800, marginTop: '2px' }}>✓ DELIVERED</div>}
                       {order.status === 'Partial Delivery' && <div style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800, marginTop: '2px' }}>⚡ PARTIAL DISPATCH</div>}
                    </td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                       <div style={{ fontWeight: 700 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                       <div>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                      <span style={{ color: balance > 0 ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)' }}>{balance.toLocaleString()}</span>
                      {activeFilter === 'archive' && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>of {(order.handed_to_stock_total || 0).toLocaleString()} received</div>}
                    </td>
                    <td>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <progress value={order.handed_to_dispatch_total || 0} max={order.handed_to_stock_total} style={{ width: '40px' }}></progress>
                         <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{(order.handed_to_dispatch_total || 0).toLocaleString()} / {order.handed_to_stock_total?.toLocaleString()}</span>
                       </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                       {activeFilter === 'queue' && balance > 0 ? (
                         <button 
                           className="primary-btn" 
                           onClick={() => {
                             setShowDispatchModal(order);
                             setDispatchData({ ...dispatchData, quantity: balance });
                           }}
                           style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                         >
                           LOAD FLEET
                         </button>
                       ) : (
                         <span style={{ fontSize: '0.6rem', color: order.status === 'Delivered' ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 700 }}>
                           {order.status === 'Delivered' ? '✓ COMPLETE' : 'DISPATCHED'}
                         </span>
                       )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                   <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Logistics clear.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDispatchModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>Dispatch Authorization</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ID: {showDispatchModal.id.slice(0, 8)}</p>
              </div>
              <button className="secondary-btn" onClick={() => setShowDispatchModal(null)} style={{ padding: '4px' }}><X size={16} /></button>
            </div>
            
            <form onSubmit={(e) => {
               e.preventDefault();
               const amount = parseInt(dispatchData.quantity);
               const newTotalOut = (showDispatchModal.handed_to_dispatch_total || 0) + amount;
               const isFullyDelivered = newTotalOut >= showDispatchModal.quantity;
               const now = new Date().toISOString();
               const data = {
                 handed_to_dispatch_total: newTotalOut,
                 truck_details: dispatchData.truck,
                 driver_info: `${dispatchData.driver} (${dispatchData.driver_phone})`,
                 dispatch_comment: dispatchData.notes,
                 dispatch_date: now,
                 dispatch_initiated_by: profile.full_name,
                 stage_4_exit_at: now,
                 stage_5_entry_at: now,
                 status: isFullyDelivered ? 'Delivered' : 'Partial Delivery'
               };
               onUpdateWorkflow(showDispatchModal.id, 5, data);
               setShowDispatchModal(null);
            }} style={{ padding: '16px' }}>
               <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                  <div>
                     <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800 }}>STOCK RECEIVED</div>
                     <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{showDispatchModal.handed_to_stock_total?.toLocaleString()}</div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                  <div>
                     <div style={{ fontSize: '0.6rem', color: 'var(--warning)', fontWeight: 800 }}>DISPATCHED</div>
                     <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{(showDispatchModal.handed_to_dispatch_total || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                  <div>
                     <div style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>AVAILABLE</div>
                     <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{(showDispatchModal.handed_to_stock_total - (showDispatchModal.handed_to_dispatch_total || 0)).toLocaleString()}</div>
                  </div>
               </div>

               <div className="form-group">
                  <label>LOAD QTY</label>
                  <input 
                    required 
                    type="number" 
                    max={showDispatchModal.handed_to_stock_total - (showDispatchModal.handed_to_dispatch_total || 0)}
                    value={dispatchData.quantity}
                    onChange={e => setDispatchData({...dispatchData, quantity: e.target.value})}
                    style={{ height: '32px' }}
                  />
               </div>
               <div className="form-grid-2">
                 <div className="form-group">
                    <label>DRIVER NAME</label>
                    <input required type="text" placeholder="..." value={dispatchData.driver} onChange={e => setDispatchData({...dispatchData, driver: e.target.value})} style={{ height: '32px' }} />
                 </div>
                 <div className="form-group">
                    <label>DRIVER CONTACT</label>
                    <input required type="text" placeholder="Phone" value={dispatchData.driver_phone} onChange={e => setDispatchData({...dispatchData, driver_phone: e.target.value})} style={{ height: '32px' }} />
                 </div>
               </div>
               <div className="form-group">
                  <label>TRUCK PLATE / SPECS</label>
                  <input required type="text" placeholder="RAE..." value={dispatchData.truck} onChange={e => setDispatchData({...dispatchData, truck: e.target.value})} style={{ height: '32px' }} />
               </div>
               <div className="form-group">
                  <label>NOTES</label>
                  <textarea rows="2" placeholder="..." value={dispatchData.notes} onChange={e => setDispatchData({...dispatchData, notes: e.target.value})}></textarea>
               </div>
               <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="secondary-btn" onClick={() => setShowDispatchModal(null)} style={{ flex: 1, height: '36px' }}>Abort</button>
                  <button type="submit" className="primary-btn" style={{ flex: 2, height: '36px' }}>CONFIRM DISPATCH</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
