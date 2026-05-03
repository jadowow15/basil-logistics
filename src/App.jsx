import React, { useState, useEffect } from 'react';
import { 
  Box, 
  ClipboardList, 
  LayoutDashboard, 
  Settings, 
  Users, 
  TrendingUp, 
  Menu, 
  X, 
  Search, 
  LogOut, 
  UserPlus,
  Clock,
  CheckCircle,
  Truck,
  PenTool,
  Cpu,
  Calendar,
  Package,
  AlertCircle,
  Activity,
  Warehouse,
  BarChart2
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import Clients from './components/Clients';
import StockManagement from './components/StockManagement';
import BusinessReport from './components/BusinessReport';
import { supabase } from './supabaseClient';

const App = () => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  const [isInitialSetup, setIsInitialSetup] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;

    const initAuth = async () => {
      const { data: statusData } = await supabase.from('profiles').select('id').limit(1);
      const needsSetup = !statusData || statusData.length === 0;
      setIsInitialSetup(needsSetup);

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) fetchProfile(sess.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        console.error("Database check failed:", error);
        setError(`Database Error: ${error.message}. Please run the SQL script in Supabase.`);
        return;
      }
      setIsInitialSetup(!data || data.length === 0);
    } catch (err) {
      setError("Failed to connect to Supabase. Check your internet.");
    }
  };

  const fetchProfile = async (userId) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (error || !data) {
        console.error("Profile fetch error:", error);
        setError('Your employee profile could not be found. Please check your internet or contact Admin.');
        setLoading(false);
        return;
      }

      if (data.status === 'Deactivated') {
        await supabase.auth.signOut();
        setSession(null);
        setError('Your account has been deactivated. Please contact the Administrative Officer.');
        setLoading(false);
        return;
      }

      setProfile(data);
      fetchOrders(data, true);
    } catch (err) {
      setError('Connection error while fetching profile.');
      setLoading(false);
    }
  };

  const fetchOrders = async (userProfile, isInitial = false) => {
    if (isInitial) setLoading(true);
    let query = supabase.from('orders').select('*');

    if (userProfile && !['CEO', 'Admin'].includes(userProfile.role)) {
      const role = userProfile.role;
      // Fetch a broader range so archiving, partial fulfillment, and timeline work correctly
      if (role === 'Reception') {
        query = query.in('workflow_stage', [1, 2]);
      } else if (role === 'Design') {
        query = query.gte('workflow_stage', 2);
      } else if (role === 'Production') {
        query = query.gte('workflow_stage', 2); // needs to see partial orders at stage 4+
      } else if (role === 'Stock') {
        query = query.gte('workflow_stage', 3);
      } else if (role === 'Dispatch') {
        query = query.in('workflow_stage', [4, 5]);
      }
    }

    const { data } = await query.order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const handleUpdateWorkflow = async (id, stage, data) => {
    // Optimistic Update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, workflow_stage: stage, ...data } : o));
    
    const { error } = await supabase.from('orders').update({ workflow_stage: stage, ...data }).eq('id', id);
    if (error) {
       console.error("Update failed:", error);
       alert("DATABASE ERROR: " + error.message + "\nDetails: " + error.details);
       fetchOrders(profile); // Revert on failure
    }
  };

  useEffect(() => {
    if (session && profile) {
      const subscription = supabase.channel('orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          const isExecutive = ['CEO', 'Admin'].includes(profile.role);
          const stageMap = { 'Reception': [1], 'Design': [2], 'Production': [2, 3], 'Stock': [3, 4, 5], 'Dispatch': [4, 5] };
          const userStages = stageMap[profile.role] || [];
          
          const shouldSee = isExecutive || userStages.includes(payload.new?.workflow_stage);

          if (payload.eventType === 'UPDATE') {
            if (shouldSee) {
              setOrders(prev => {
                const exists = prev.find(o => o.id === payload.new.id);
                if (exists) return prev.map(o => o.id === payload.new.id ? payload.new : o);
                return [payload.new, ...prev];
              });
            } else {
              setOrders(prev => prev.filter(o => o.id === payload.new.id ? false : true));
            }
          } else if (payload.eventType === 'INSERT') {
            if (shouldSee) {
              setOrders(prev => {
                const exists = prev.find(o => o.id === payload.new.id);
                if (exists) return prev;
                return [payload.new, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id === payload.old.id ? false : true));
          }
        })
        .subscribe();
      return () => supabase.removeChannel(subscription);
    }
  }, [session, profile]);

  const getStats = () => {
    if (!profile) return [];
    const role = profile.role;
    if (role === 'CEO') {
      const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
      const totalUnits = orders.reduce((acc, o) => acc + (parseInt(o.quantity) || 0), 0);
      const unitsRemaining = orders.reduce((acc, o) => acc + ((parseInt(o.quantity) || 0) - (parseInt(o.handed_to_dispatch_total) || 0)), 0);
      
      return [
        { title: 'Gross Pipeline Value', value: `${orders.reduce((acc, o) => acc + ((parseInt(o.quantity) || 0) * (parseFloat(o.unit_price) || 0)), 0).toLocaleString()} RWF`, icon: <TrendingUp size={20} />, trend: 'Strategic', trendType: 'positive' },
        { title: 'Total Fulfillment Balance', value: `${unitsRemaining.toLocaleString()} units`, icon: <Clock size={20} />, trend: 'Pending Delivery', trendType: 'warning' },
        { title: 'Active Projects', value: (orders.length - deliveredOrders).toString(), icon: <ClipboardList size={20} />, trend: 'Orders', trendType: 'neutral' },
        { title: 'Strategic Portfolio', value: new Set(orders.map(o => o.client_name)).size.toString(), icon: <Users size={20} />, trend: 'Entities', trendType: 'positive' },
      ];
    }
    if (role === 'Admin') {
        const unitsRemaining = orders.reduce((acc, o) => acc + ((parseInt(o.quantity) || 0) - (parseInt(o.handed_to_dispatch_total) || 0)), 0);
        const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;

        return [
          { title: 'Initiated Order', value: orders.filter(o => o.workflow_stage < 4).length.toString(), icon: <ClipboardList size={20} />, trend: 'Active', trendType: 'positive' },
          { title: 'Units Remaining', value: unitsRemaining.toLocaleString(), icon: <Clock size={20} />, trend: 'Balance', trendType: 'warning' },
          { title: 'Handover Pipeline', value: orders.filter(o => o.workflow_stage === 1).length.toString(), icon: <Clock size={20} />, trend: 'Reception', trendType: 'neutral' },
          { title: 'Completed Success', value: deliveredOrders.toString(), icon: <CheckCircle size={20} />, trend: 'Delivered', trendType: 'positive' },
        ];
    }
    if (role === 'Reception') {
      return [
        { title: 'Daily Intake Rate', value: orders.filter(o => o.reception_date === new Date().toISOString().split('T')[0]).length.toString(), icon: <Calendar size={20} />, trend: 'Live', trendType: 'positive' },
        { title: 'Awaiting Initialization', value: orders.filter(o => o.workflow_stage === 1).length.toString(), icon: <Clock size={20} />, trend: 'Queue', trendType: 'neutral' },
        { title: 'Total Orders', value: orders.length.toString(), icon: <ClipboardList size={20} />, trend: 'Historical', trendType: 'positive' },
        { title: 'Expected Fulfillment', value: orders.filter(o => o.expected_delivery_date).length.toString(), icon: <Box size={20} />, trend: 'Committed', trendType: 'positive' },
      ];
    }
    if (role === 'Design') {
      return [
        { title: 'Technical Queue', value: orders.length.toString(), icon: <PenTool size={20} />, trend: 'Active Load', trendType: 'neutral' },
        { title: 'Drafts Completed', value: orders.filter(o => o.design_date === new Date().toISOString().split('T')[0]).length.toString(), icon: <CheckCircle size={20} />, trend: 'Daily', trendType: 'positive' },
        { title: 'Awaiting Specs', value: orders.filter(o => !o.design_info).length.toString(), icon: <ClipboardList size={20} />, trend: 'Action Reqd', trendType: 'neutral' },
        { title: 'Cycle Efficiency', value: '1.2 Days', icon: <Clock size={20} />, trend: 'Optimal', trendType: 'positive' },
      ];
    }
    if (role === 'Production') {
      const produced = orders.reduce((acc, o) => acc + (parseInt(o.produced_quantity) || 0), 0);
      const target = orders.reduce((acc, o) => acc + (parseInt(o.quantity) || 0), 0);
      return [
        { title: 'Cumulative Produced', value: produced.toLocaleString(), icon: <Cpu size={20} />, trend: 'Live Floor', trendType: 'positive' },
        { title: 'Floor Target', value: target.toLocaleString(), icon: <Box size={20} />, trend: 'Required', trendType: 'neutral' },
        { title: 'Yield Rate', value: target > 0 ? `${Math.round((produced / target) * 100)}%` : '0%', icon: <TrendingUp size={20} />, trend: 'Progress', trendType: 'positive' },
        { title: 'Active Batches', value: orders.length.toString(), icon: <Activity size={20} />, trend: 'Processing', trendType: 'positive' },
      ];
    }
    if (role === 'Dispatch') {
      return [
        { title: 'Fleet Readiness', value: orders.length.toString(), icon: <Package size={20} />, trend: 'Queue', trendType: 'positive' },
        { title: 'Dispatched Today', value: (orders.filter(o => o.workflow_stage === 5).length).toString(), icon: <Truck size={20} />, trend: 'Logistics', trendType: 'positive' },
        { title: 'SLA Success Rate', value: '99.2%', icon: <CheckCircle size={20} />, trend: 'On Guard', trendType: 'positive' },
        { title: 'Fleet Lead Time', value: '4.5 Hrs', icon: <Clock size={20} />, trend: 'Efficient', trendType: 'positive' },
      ];
    }
    if (role === 'Stock') {
       const inStock = orders.reduce((acc, o) => acc + ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)), 0);
       const readyForDispatch = orders.filter(o => ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)) > 0).length;
       return [
         { title: 'Warehouse Inventory', value: inStock.toLocaleString(), icon: <Warehouse size={20} />, trend: 'Physical Units', trendType: 'positive' },
         { title: 'Ready for Dispatch', value: readyForDispatch.toString(), icon: <Package size={20} />, trend: 'Orders Pending', trendType: 'neutral' },
         { title: 'Warehouse Movements', value: orders.length.toString(), icon: <Activity size={20} />, trend: 'Active Load', trendType: 'positive' },
         { title: 'Fulfillment Yield', value: '94.8%', icon: <TrendingUp size={20} />, trend: 'Target: 95%', trendType: 'positive' },
       ];
    }
    return [];
  };

  const handleLogout = () => supabase.auth.signOut();

  if (error) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ border: '1px solid var(--error)' }}>
          <h2 style={{ color: 'var(--error)' }}>System Error</h2>
          <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>{error}</p>
          <button className="login-btn" onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={(sess) => {
      setSession(sess);
      checkSystemStatus();
    }} isInitialSetup={isInitialSetup} />;
  }

  if (session && !profile) {
    return (
      <div className="login-container">
        <div className="loader">Connecting to Basil Industry Data...</div>
        <button onClick={handleLogout} className="text-btn" style={{ marginTop: '20px', color: 'var(--text-muted)' }}>
          <LogOut size={16} /> Sign Out & Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <img src="/basil-logo.avif" alt="Logo" className="logo-img" />
          {isSidebarOpen && <span className="logo-text">BASIL INDUSTRY</span>}
        </div>
        <nav className="sidebar-nav">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} shrunk={!isSidebarOpen} />
          <NavItem 
            icon={<Package size={20} />} 
            label={
              ['Reception', 'Design'].includes(profile?.role) ? 'Orders' :
              profile?.role === 'Stock' ? 'Stock' :
              profile?.role === 'Production' ? 'Production' :
              'Orders'
            } 
            active={activeTab === 'orders'} 
            onClick={() => setActiveTab('orders')} 
            shrunk={!isSidebarOpen} 
          />
          {['CEO', 'Admin', 'Reception', 'HR'].includes(profile?.role) && (
            <NavItem icon={<Users size={20} />} label="Clients" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} shrunk={!isSidebarOpen} />
          )}
          {['CEO', 'Admin'].includes(profile?.role) && (
            <>
              <div className="nav-divider"></div>
              <NavItem icon={<UserPlus size={20} />} label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} shrunk={!isSidebarOpen} />
            </>
          )}
          {profile?.role === 'CEO' && (
            <NavItem icon={<BarChart2 size={20} />} label="Report" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} shrunk={!isSidebarOpen} />
          )}
          <div className="nav-divider"></div>
          <button className="nav-item logout" onClick={handleLogout}>
            <div className="nav-icon"><LogOut size={20} /></div>
            {isSidebarOpen && <span className="nav-label">Sign Out</span>}
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="system-title-tag">
            <span></span>
            ORDER TRUCKING SYSTEM
          </div>
          <div className="header-actions">
            <div className="user-profile">
              <div className="user-info">
                <p className="user-name">{profile?.full_name}</p>
                <p className="user-role">{profile?.role} Dept.</p>
              </div>
              <div className="user-avatar">{profile?.full_name?.charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="content-wrapper">
          {profile && activeTab === 'dashboard' && (
            <Dashboard 
              stats={getStats() || []} 
              recentOrders={orders || []} 
              role={profile?.role} 
            />
          )}

          {profile && activeTab === 'orders' && (
            profile.role === 'Stock' ? (
              <StockManagement 
                orders={orders || []} 
                profile={profile}
                onUpdateWorkflow={handleUpdateWorkflow} 
              />
            ) : (
              <Orders 
                orders={orders || []} 
                profile={profile}
                onAddOrder={async (o) => {
                  const { error } = await supabase.from('orders').insert([o]);
                  if (error) {
                    console.error('Insert Error:', error);
                    alert('Order Creation Failed: ' + error.message);
                  } else {
                    // Update locally immediately for instant feedback
                    setOrders(prev => [o, ...prev]);
                  }
                }} 
                onUpdateWorkflow={handleUpdateWorkflow} 
              />
            )
          )}

          {profile && activeTab === 'clients' && <Clients profile={profile} />}
          {profile && activeTab === 'users' && <UserManagement profile={profile} />}
          {profile && activeTab === 'reports' && profile.role === 'CEO' && (
            <BusinessReport orders={orders || []} />
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick, shrunk = false }) => (
  <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
    <div className="nav-icon">{icon}</div>
    {!shrunk && <span className="nav-label">{label}</span>}
  </button>
);

export default App;
