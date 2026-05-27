import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import DeliveryNote from './DeliveryNote';
import RawMaterials from './RawMaterials';
import { 
  ClipboardList, 
  Search, 
  Truck, 
  Archive, 
  CheckCircle2, 
  X,
  Plus,
  Printer,
  UploadCloud,
  FileText,
  Package
} from 'lucide-react';

const StockManagement = ({ profile, orders, onUpdateWorkflow }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('queue');
  const [stockCategory, setStockCategory] = useState('ordered');
  const [showDispatchModal, setShowDispatchModal] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [uploadOrder, setUploadOrder] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dispatchData, setDispatchData] = useState({
    quantity: '',
    truck: '',
    driver: '',
    driver_phone: '',
    notes: ''
  });
  const [showReprintModal, setShowReprintModal] = useState(null);
  const [reprintData, setReprintData] = useState({
    quantity: '',
    truck: '',
    driver_info: ''
  });
  
  const totalInWarehouse = (orders || []).reduce((acc, o) => acc + ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)), 0);
  
  const filteredOrders = (orders || []).filter(order => {
    const hasEverBeenInStock = (order.handed_to_stock_total || 0) > 0;
    const hasBalance = (order.handed_to_stock_total || 0) > (order.handed_to_dispatch_total || 0);
    const matchesSearch = (order.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (order.product_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'queue') {
      // Only show orders with remaining balance that are NOT fully delivered
      return hasBalance && matchesSearch;
    } else {
      return hasEverBeenInStock && matchesSearch;
    }
  }).sort((a, b) => (b.created_at ? new Date(b.created_at) : 0) - (a.created_at ? new Date(a.created_at) : 0));

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = ['Order ID', 'Client Name', 'Product', 'Date Registered', 'Received from Prod', 'Total Dispatched', 'Current Balance in Stock', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredOrders.forEach(order => {
      const inStock = order.handed_to_stock_total || 0;
      const dispatched = order.handed_to_dispatch_total || 0;
      const balance = inStock - dispatched;

      const row = [
        order.id,
        `"${(order.client_name || '').replace(/"/g, '""')}"`,
        `"${(order.product_name || '').replace(/"/g, '""')}"`,
        new Date(order.created_at).toLocaleDateString(),
        inStock,
        dispatched,
        balance,
        order.status || 'Pending'
      ];
      csvRows.push(row.join(','));
    });
    
    const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 300);
  };

  const handleReprintClick = (order) => {
    setShowReprintModal(order);
    setReprintData({
      quantity: parseInt(order.dispatch_info) || order.handed_to_dispatch_total || order.quantity || 0,
      truck: order.truck_details || '',
      driver_info: order.driver_info || ''
    });
  };

  const handleUploadProof = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadOrder) return;
    
    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${uploadOrder.id}-proof-${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('delivery_proofs')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('delivery_proofs')
        .getPublicUrl(fileName);

      const updateData = {
        delivery_proof_url: publicUrlData.publicUrl,
        delivery_proof_uploaded_at: new Date().toISOString(),
        delivery_proof_uploaded_by: profile.full_name
      };

      await onUpdateWorkflow(uploadOrder.id, uploadOrder.workflow_stage, updateData);
      
      alert('Proof of Delivery uploaded successfully!');
      setUploadOrder(null);
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      alert('Failed to upload proof. Make sure the delivery_proofs bucket exists and is public.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="inner-content">
      {printOrder && <DeliveryNote order={printOrder} />}

      <header className="content-title">
        <h1>LOGISTICS LEDGER</h1>
        <p>WAREHOUSE INVENTORY & FLEET CONTROL</p>
      </header>

      {/* ── Category Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setStockCategory('ordered')}
          style={{
            padding: '8px 20px', fontSize: '0.72rem', fontWeight: 800, borderRadius: '8px', border: '2px solid',
            borderColor: stockCategory === 'ordered' ? 'var(--accent-color)' : 'var(--border-color)',
            background: stockCategory === 'ordered' ? 'var(--accent-glow)' : 'transparent',
            color: stockCategory === 'ordered' ? 'var(--accent-color)' : 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
          }}
        >
          <Truck size={14} /> ORDERED PRODUCTS
        </button>
        <button
          onClick={() => setStockCategory('raw')}
          style={{
            padding: '8px 20px', fontSize: '0.72rem', fontWeight: 800, borderRadius: '8px', border: '2px solid',
            borderColor: stockCategory === 'raw' ? '#10b981' : 'var(--border-color)',
            background: stockCategory === 'raw' ? 'rgba(16,185,129,0.1)' : 'transparent',
            color: stockCategory === 'raw' ? '#10b981' : 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
          }}
        >
          <Package size={14} /> RAW MATERIALS
        </button>
      </div>

      {/* ── Raw Materials Section ──────────────────────────────────── */}
      {stockCategory === 'raw' && <RawMaterials profile={profile} />}

      {/* ── Ordered Products Section ───────────────────────────────── */}
      {stockCategory === 'ordered' && (<>

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
          
          <button 
            className="secondary-btn" 
            onClick={handleExportCSV} 
            disabled={filteredOrders.length === 0}
            style={{ padding: '4px 12px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '6px', height: '28px', marginLeft: 'auto' }}
          >
            <ClipboardList size={14} /> EXPORT CSV
          </button>
          
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-color)', fontSize: '0.62rem', marginLeft: '10px' }}>
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
                    <td style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                       <div style={{ marginBottom: '4px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--accent-color)', opacity: 0.8, fontSize: '0.6rem' }}>INITIATION</div>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                       </div>
                       <div>
                          <div style={{ fontWeight: 800, color: 'var(--info)', opacity: 0.8, fontSize: '0.6rem' }}>STOCK ENTRY</div>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{order.stage_4_entry_at ? new Date(order.stage_4_entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</div>
                       </div>
                       <div style={{ opacity: 0.3, fontSize: '0.55rem', marginTop: '4px' }}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</div>
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
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                           <span style={{ fontSize: '0.6rem', color: order.status === 'Delivered' ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 700 }}>
                             {order.status === 'Delivered' ? '✓ COMPLETE' : 'DISPATCHED'}
                           </span>
                           <div style={{ display: 'flex', gap: '4px' }}>
                             <button className="icon-btn" onClick={() => handleReprintClick(order)} title="Reprint Waybill">
                               <Printer size={14} />
                             </button>
                             {order.delivery_proof_url ? (
                               <a href={order.delivery_proof_url} target="_blank" rel="noreferrer" className="secondary-btn" style={{ padding: '6px', color: 'var(--accent-color)', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.65rem' }} title="View Proof">
                                 <FileText size={14} /> VIEW PROOF
                               </a>
                             ) : (
                               <button className="secondary-btn" onClick={() => setUploadOrder(order)} style={{ padding: '6px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.65rem' }} title="Upload Signed Proof (after delivery)">
                                 <UploadCloud size={14} /> UPLOAD PROOF
                               </button>
                             )}
                           </div>
                         </div>
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
               // Fully delivered = all stock handed to dispatch (comparing with total order quantity)
               const stockTotal = showDispatchModal.quantity;
               const isFullyDelivered = newTotalOut >= stockTotal;
               const now = new Date().toISOString();
               const data = {
                 handed_to_dispatch_total: newTotalOut,
                 dispatch_info: amount.toString(), // Save current load quantity to dispatch_info for reprints
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
               // Auto-print the waybill immediately after confirming dispatch
               setPrintOrder({ 
                 ...showDispatchModal, 
                 handed_to_dispatch_total: newTotalOut, 
                 current_dispatch_amount: amount,
                 truck_details: dispatchData.truck, 
                 driver_info: `${dispatchData.driver} (${dispatchData.driver_phone})` 
               });
               setTimeout(() => { window.print(); setPrintOrder(null); }, 400);
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

      {uploadOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>Upload Proof of Delivery</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Order: {uploadOrder.product_name}</p>
              </div>
              <button className="secondary-btn" onClick={() => setUploadOrder(null)} style={{ padding: '4px' }}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleUploadProof} style={{ padding: '16px' }}>
              <div className="form-group">
                <label>SIGNED WAYBILL (PDF/IMAGE)</label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="secondary-btn" onClick={() => setUploadOrder(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={uploading} style={{ flex: 2 }}>
                  {uploading ? 'Uploading...' : 'UPLOAD PROOF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReprintModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>Reprint Delivery Waybill</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Order: {showReprintModal.client_name}</p>
              </div>
              <button className="secondary-btn" onClick={() => setShowReprintModal(null)} style={{ padding: '4px' }}><X size={16} /></button>
            </div>
            
            <form onSubmit={(e) => {
               e.preventDefault();
               const amount = parseInt(reprintData.quantity);
               setPrintOrder({ 
                 ...showReprintModal, 
                 current_dispatch_amount: amount,
                 truck_details: reprintData.truck, 
                 driver_info: reprintData.driver_info 
               });
               setTimeout(() => { window.print(); setPrintOrder(null); }, 400);
               setShowReprintModal(null);
            }} style={{ padding: '16px' }}>
               <div className="form-group">
                  <label>DELIVERY QUANTITY TO PRINT</label>
                  <input 
                    required 
                    type="number" 
                    min="1"
                    max={showReprintModal.quantity}
                    value={reprintData.quantity}
                    onChange={e => setReprintData({...reprintData, quantity: e.target.value})}
                    style={{ height: '32px' }}
                  />
               </div>
               <div className="form-group">
                  <label>DRIVER NAME & CONTACT</label>
                  <input 
                    required 
                    type="text" 
                    value={reprintData.driver_info} 
                    onChange={e => setReprintData({...reprintData, driver_info: e.target.value})} 
                    style={{ height: '32px' }} 
                  />
               </div>
               <div className="form-group">
                  <label>TRUCK PLATE / SPECS</label>
                  <input 
                    required 
                    type="text" 
                    value={reprintData.truck} 
                    onChange={e => setReprintData({...reprintData, truck: e.target.value})} 
                    style={{ height: '32px' }} 
                  />
               </div>
               <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="secondary-btn" onClick={() => setShowReprintModal(null)} style={{ flex: 1, height: '36px' }}>Abort</button>
                  <button type="submit" className="primary-btn" style={{ flex: 2, height: '36px' }}>PRINT WAYBILL</button>
               </div>
            </form>
          </div>
        </div>
      )}
      {/* end ordered section */}
      </>)}
    </div>
  );
};

export default StockManagement;
