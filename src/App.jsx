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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Close sidebar when switching to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 769) {
        setIsSidebarOpen(false); // on desktop sidebar is always visible via CSS, not controlled by state
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setActiveTab('dashboard'); // Reset view on auth change
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
      // Ensure we starts at a valid tab for this role
      const role = data.role;
      const restrictedUsers = ['CEO', 'Admin'];
      const restrictedClients = ['CEO', 'Admin', 'Reception', 'HR'];
      
      if (activeTab === 'users' && !restrictedUsers.includes(role)) setActiveTab('dashboard');
      if (activeTab === 'clients' && !restrictedClients.includes(role)) setActiveTab('dashboard');
      if (activeTab === 'reports' && role !== 'CEO') setActiveTab('dashboard');

      fetchOrders(data, true);
    } catch (err) {
      setError('Connection error while fetching profile.');
      setLoading(false);
    }
  };

  // Robust permission guard: sync activeTab with roles
  useEffect(() => {
    if (!profile) return;
    
    const role = profile.role;
    const restrictedUsers = ['CEO', 'Admin'];
    const restrictedClients = ['CEO', 'Admin', 'Reception', 'HR'];

    if (activeTab === 'users' && !restrictedUsers.includes(role)) {
      setActiveTab('dashboard');
    } else if (activeTab === 'clients' && !restrictedClients.includes(role)) {
      setActiveTab('dashboard');
    } else if (activeTab === 'reports' && role !== 'CEO') {
      setActiveTab('dashboard');
    }
  }, [profile, activeTab]);

  const fetchOrders = async (userProfile, isInitial = false) => {
    if (isInitial) setLoading(true);
    let query = supabase.from('orders').select('*');

    if (userProfile && !['CEO', 'Admin'].includes(userProfile.role)) {
      const role = userProfile.role;
      if (role === 'Reception') {
        query = query.in('workflow_stage', [1, 2]);
      } else if (role === 'Design') {
        query = query.gte('workflow_stage', 2);
      } else if (role === 'Production') {
        query = query.gte('workflow_stage', 2);
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
    setOrders(prev => prev.map(o => o.id === id ? { ...o, workflow_stage: stage, ...data } : o));
    
    const { error } = await supabase.from('orders').update({ workflow_stage: stage, ...data }).eq('id', id);
    if (error) {
       console.error("Update failed:", error);
       alert("DATABASE ERROR: " + error.message + "\nDetails: " + error.details);
       fetchOrders(profile);
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
        { title: 'Awaiting Init', value: orders.filter(o => o.workflow_stage === 1).length.toString(), icon: <Clock size={20} />, trend: 'Queue', trendType: 'neutral' },
        { title: 'Total Orders', value: orders.length.toString(), icon: <ClipboardList size={20} />, trend: 'Historical', trendType: 'positive' },
        { title: 'Committed', value: orders.filter(o => o.expected_delivery_date).length.toString(), icon: <Box size={20} />, trend: 'Expected', trendType: 'positive' },
      ];
    }
    if (role === 'Design') {
      return [
        { title: 'Tech Queue', value: orders.length.toString(), icon: <PenTool size={20} />, trend: 'Active Load', trendType: 'neutral' },
        { title: 'Drafts Done', value: orders.filter(o => o.design_date === new Date().toISOString().split('T')[0]).length.toString(), icon: <CheckCircle size={20} />, trend: 'Daily', trendType: 'positive' },
        { title: 'Awaiting Specs', value: orders.filter(o => !o.design_info).length.toString(), icon: <ClipboardList size={20} />, trend: 'Action Reqd', trendType: 'neutral' },
        { title: 'Cycle Time', value: '1.2 Days', icon: <Clock size={20} />, trend: 'Optimal', trendType: 'positive' },
      ];
    }
    if (role === 'Production') {
      const produced = orders.reduce((acc, o) => acc + (parseInt(o.produced_quantity) || 0), 0);
      const target = orders.reduce((acc, o) => acc + (parseInt(o.quantity) || 0), 0);
      return [
        { title: 'Produced', value: produced.toLocaleString(), icon: <Cpu size={20} />, trend: 'Live Floor', trendType: 'positive' },
        { title: 'Floor Target', value: target.toLocaleString(), icon: <Box size={20} />, trend: 'Required', trendType: 'neutral' },
        { title: 'Yield Rate', value: target > 0 ? `${Math.round((produced / target) * 100)}%` : '0%', icon: <TrendingUp size={20} />, trend: 'Progress', trendType: 'positive' },
        { title: 'Active Batches', value: orders.length.toString(), icon: <Activity size={20} />, trend: 'Processing', trendType: 'positive' },
      ];
    }
    if (role === 'Dispatch') {
      return [
        { title: 'Fleet Queue', value: orders.length.toString(), icon: <Package size={20} />, trend: 'Ready', trendType: 'positive' },
        { title: 'Dispatched', value: (orders.filter(o => o.workflow_stage === 5).length).toString(), icon: <Truck size={20} />, trend: 'Logistics', trendType: 'positive' },
        { title: 'SLA Rate', value: '99.2%', icon: <CheckCircle size={20} />, trend: 'On Guard', trendType: 'positive' },
        { title: 'Lead Time', value: '4.5 Hrs', icon: <Clock size={20} />, trend: 'Efficient', trendType: 'positive' },
      ];
    }
    if (role === 'Stock') {
       const inStock = orders.reduce((acc, o) => acc + ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)), 0);
       const readyForDispatch = orders.filter(o => ((o.handed_to_stock_total || 0) - (o.handed_to_dispatch_total || 0)) > 0).length;
       return [
         { title: 'Warehouse Inv.', value: inStock.toLocaleString(), icon: <Warehouse size={20} />, trend: 'Physical Units', trendType: 'positive' },
         { title: 'Ready Dispatch', value: readyForDispatch.toString(), icon: <Package size={20} />, trend: 'Orders Pending', trendType: 'neutral' },
         { title: 'Movements', value: orders.length.toString(), icon: <Activity size={20} />, trend: 'Active Load', trendType: 'positive' },
         { title: 'Fulfillment', value: '94.8%', icon: <TrendingUp size={20} />, trend: 'Target: 95%', trendType: 'positive' },
       ];
    }
    return [];
  };

  const handleLogout = () => {
    setActiveTab('dashboard');
    supabase.auth.signOut();
  };

  // Helper: navigate and close sidebar (mobile)
  const navigate = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // Build bottom nav tabs based on role
  const getNavTabs = () => {
    if (!profile) return [];
    const tabs = [
      { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
    ];

    const ordersLabel = 
      profile.role === 'Stock' ? 'Stock' :
      profile.role === 'Production' ? 'Prod.' :
      'Orders';

    tabs.push({ id: 'orders', label: ordersLabel, icon: <Package size={20} /> });

    if (['CEO', 'Admin', 'Reception', 'HR'].includes(profile.role)) {
      tabs.push({ id: 'clients', label: 'Clients', icon: <Users size={20} /> });
    }

    if (['CEO', 'Admin'].includes(profile.role)) {
      tabs.push({ id: 'users', label: 'Users', icon: <UserPlus size={20} /> });
    }

    if (profile.role === 'CEO') {
      tabs.push({ id: 'reports', label: 'Report', icon: <BarChart2 size={20} /> });
    }

    return tabs;
  };

  if (error) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ border: '1px solid var(--error)', padding: '32px 24px' }}>
          <h2 style={{ color: 'var(--error)', marginBottom: '12px' }}>System Error</h2>
          <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>{error}</p>
          <button className="primary-btn" style={{ width: '100%' }} onClick={() => window.location.reload()}>Retry Connection</button>
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
        <div className="loader">Connecting to Basil Industries Ltd Data...</div>
        <button onClick={handleLogout} className="secondary-btn" style={{ marginTop: '20px', color: 'var(--text-muted)' }}>
          <LogOut size={16} /> Sign Out & Retry
        </button>
      </div>
    );
  }

  const navTabs = getNavTabs();

  return (
    <div className="app-container">
      {/* Mobile sidebar overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* Sidebar — always visible on desktop, drawer on mobile */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/basil-logo.avif" alt="Logo" className="logo-img" />
          <span className="logo-text">BASIL INDUSTRIES LTD</span>
        </div>
        <nav className="sidebar-nav">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigate('dashboard')} />
          <NavItem 
            icon={<Package size={20} />} 
            label={
              ['Reception', 'Design'].includes(profile?.role) ? 'Orders' :
              profile?.role === 'Stock' ? 'Stock' :
              profile?.role === 'Production' ? 'Production' :
              'Orders'
            } 
            active={activeTab === 'orders'} 
            onClick={() => navigate('orders')} 
          />
          {['CEO', 'Admin', 'Reception', 'HR'].includes(profile?.role) && (
            <NavItem icon={<Users size={20} />} label="Clients" active={activeTab === 'clients'} onClick={() => navigate('clients')} />
          )}
          {['CEO', 'Admin'].includes(profile?.role) && (
            <>
              <div className="nav-divider"></div>
              <NavItem icon={<UserPlus size={20} />} label="Users" active={activeTab === 'users'} onClick={() => navigate('users')} />
            </>
          )}
          {profile?.role === 'CEO' && (
            <NavItem icon={<BarChart2 size={20} />} label="Report" active={activeTab === 'reports'} onClick={() => navigate('reports')} />
          )}
          <div className="nav-divider"></div>
          <button className="nav-item logout" onClick={handleLogout}>
            <div className="nav-icon"><LogOut size={20} /></div>
            <span className="nav-label">Sign Out</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="system-title-tag">
            <button 
              className="menu-toggle" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span></span>
            BASIL INDUSTRIES LTD
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
                    setOrders(prev => [o, ...prev]);
                  }
                }} 
                onUpdateWorkflow={handleUpdateWorkflow} 
              />
            )
          )}

          {profile && activeTab === 'clients' && ['CEO', 'Admin', 'Reception', 'HR'].includes(profile.role) && <Clients profile={profile} />}
          {profile && activeTab === 'users' && ['CEO', 'Admin'].includes(profile.role) && <UserManagement profile={profile} />}
          {profile && activeTab === 'reports' && profile.role === 'CEO' && (
            <BusinessReport orders={orders || []} />
          )}
        </div>
      </main>

      {/* Bottom navigation — mobile only */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <div className="bottom-nav-inner">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.label}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            className="bottom-nav-item"
            onClick={handleLogout}
            aria-label="Sign Out"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick }) => (
  <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
    <div className="nav-icon">{icon}</div>
    <span className="nav-label">{label}</span>
  </button>
);

export default App;
