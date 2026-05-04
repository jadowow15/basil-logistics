import React from 'react';
import { 
  Box, 
  Warehouse,
  Clock,
  AlertCircle,
  Activity,
  TrendingUp
} from 'lucide-react';

const Dashboard = ({ stats, recentOrders, role }) => {
  const isExecutive = ['Admin', 'CEO', 'HR'].includes(role);
  const totalInWarehouse = (recentOrders || []).reduce((acc, o) => acc + ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)), 0);

  const getHeader = () => {
    switch (role) {
      case 'CEO': return { h1: 'EXECUTIVE OVERLOOK', p: 'SYSTEM ANALYTICS' };
      case 'Reception': return { h1: 'INTAKE CORE', p: 'ORDER INITIALIZATION' };
      case 'Design': return { h1: 'TECHNICAL BUREAU', p: 'ARCHITECTURAL SPECS' };
      case 'Production': return { h1: 'MANUFACTURING BATCHES', p: 'PRODUCTION FLOOR' };
      case 'Stock': return { h1: 'LOGISTICS LEDGER', p: 'WAREHOUSE CONTROL' };
      case 'Dispatch': return { h1: 'DISPATCH CONTROL', p: 'FLEET LOGS' };
      default: return { h1: 'INDUSTRIAL DASHBOARD', p: 'OPERATIONS PORTAL' };
    }
  };

  const header = getHeader();
  const roleStageMap = { 'Reception': 1, 'Design': 2, 'Production': 3, 'Stock': 4, 'Dispatch': 5 };
  const myStage = roleStageMap[role];
  const myOrders = (isExecutive ? recentOrders : recentOrders.filter(o => o.workflow_stage === myStage))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalActive = recentOrders.filter(o => (o.workflow_stage || 1) < 5).length;

  return (
    <div className="inner-content">
      <header className="content-title">
        <h1>{header.h1}</h1>
        <p>{header.p}</p>
      </header>

      <div className="stats-grid" style={{ marginBottom: '32px' }}>
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-header">
              <div className="stat-icon-wrapper" style={{ width: '28px', height: '28px' }}>{stat.icon}</div>
              <span className={`stat-trend ${stat.trendType}`}>{stat.trend}</span>
            </div>
            <h3 className="stat-label" style={{ marginBottom: '8px' }}>{stat.title}</h3>
            <p className="stat-value">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="table-card">
          <div className="card-header" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 900, letterSpacing: '0.05em' }}>ORDER MOVEMENTS</h2>
          </div>
          <div className="table-responsive">
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th>DESCRIPTOR</th>
                  <th>TIMELINE</th>
                  <th>IN ORDER</th>
                  <th>{role === 'Dispatch' ? 'DISPATCHED' : 'IN STOCK'}</th>
                  <th style={{ textAlign: 'right' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(myOrders || []).slice(0, 8).map((order) => (
                  <tr key={order.id}>
                    <td>
                        <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{order.client_name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{order.product_name}</div>
                    </td>
                    <td style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      <div style={{ marginBottom: '2px' }}>
                         <span style={{ fontWeight: 800, color: 'var(--accent-color)', opacity: 0.7, fontSize: '0.55rem' }}>INIT:</span>
                         <span style={{ color: '#fff', marginLeft: '4px' }}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                         <span style={{ fontWeight: 800, color: 'var(--info)', opacity: 0.7, fontSize: '0.55rem' }}>HAND:</span>
                         <span style={{ color: '#fff' }}>{order[`stage_${order.workflow_stage}_entry_at`] ? new Date(order[`stage_${order.workflow_stage}_entry_at`]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--accent-color)' }}>{order.produced_quantity || 0}</span>
                      <span style={{ opacity: 0.4, margin: '0 4px' }}>/</span>
                      <span>{(order.quantity || 0).toLocaleString()}</span>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--accent-color)' }}>
                      {role === 'Dispatch' 
                        ? (order.handed_to_dispatch_total || 0).toLocaleString()
                        : ((order.handed_to_stock_total || 0) - (order.handed_to_dispatch_total || 0)).toLocaleString()
                      }
                    </td>
                    <td style={{ textAlign: 'right' }}><span className="status-badge" style={{ fontSize: '0.6rem', border: '1px solid var(--border-color)' }}>{order.status || 'Active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
           <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ borderLeft: '2px solid var(--accent-color)', paddingLeft: '10px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 800, letterSpacing: '0.1em' }}>{role === 'Stock' ? 'WAREHOUSE CAPACITY' : 'ORDER STATUS'}</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                 <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{role === 'Stock' ? 'Floor Utilization' : 'Active Protocols'}</span>
                 <span style={{ fontWeight: 900 }}>{role === 'Stock' ? '78%' : totalActive}</span>
              </div>
              <progress value={role === 'Stock' ? 78 : (totalActive > 0 ? (totalActive/recentOrders.length)*100 : 0)} max="100"></progress>
           </div>
           
           <div className="stat-card" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.03)' }}>
              <div style={{ borderLeft: '2px solid var(--info)', paddingLeft: '10px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '0.7rem', color: 'var(--info)', fontWeight: 800, letterSpacing: '0.1em' }}>{role === 'Stock' ? 'DISPATCH PRIORITY' : 'SYSTEM EVENTS'}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.7rem', fontWeight: 600 }}>
                 {role === 'Stock' ? (
                    <>
                      <div>• High Priority Outbound (3)</div>
                      <div>• Loading Bay 2 Clearance</div>
                    </>
                  ) : (
                    <>
                      <div>• Batch Optimization Complete</div>
                      <div>• Network Node Stable</div>
                    </>
                  )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
