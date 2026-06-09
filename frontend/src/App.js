import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Helper function to create colored health badges
function HealthBadge({ status }) {
  let badgeColor = '#28a745'; // Green for Perfect/Good
  if (status === 'Needs Repair') badgeColor = '#ffc107'; // Yellow
  if (status === 'Damaged') badgeColor = '#dc3545'; // Red

  return (
    <span style={{ backgroundColor: badgeColor, color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', marginLeft: '10px' }}>
      {status || 'Perfect'}
    </span>
  );
}

function App() {
  const [assets, setAssets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discover');
  
  // ================= EXPANDED DATA STATES =================
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedActionFilter, setSelectedActionFilter] = useState('All Actions'); 
  const [dashboardData, setDashboardData] = useState({
    summary: { totalAssets: 0, activeAllocations: 0, pendingRequests: 0, overdueReturns: 0, utilizationRate: 0 },
    topUtilized: [],
    activeBookingsList: [],
    lowStockAlerts: []
  });

  // ================= AUTHENTICATION STATES =================
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('Consumer');
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('app_user_session');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ================= SEARCH & FILTER STATES =================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // ================= ADMIN MANAGEMENT STATES =================
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState(1);

  const [editingAssetId, setEditingAssetId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState(1);

  const [bookingDurations, setBookingDurations] = useState({});
  const [bookingQuantities, setBookingQuantities] = useState({}); // <-- ONLY NEW STATE

  const BACKEND_URL = '';

  // ================= 2-SECOND LIVE REFRESH ENGINE =================
  const fetchAllData = (userId = null, isSilent = false) => {
    if (!isSilent) setLoading(true);
    axios.get(`${BACKEND_URL}/api/analytics/dashboard`)
      .then((res) => {
        setDashboardData(res.data);
        axios.get(`${BACKEND_URL}/api/assets`).then(r => setAssets(r.data));
        axios.get(`${BACKEND_URL}/api/bookings`).then(r => setBookings(r.data));
        axios.get(`${BACKEND_URL}/api/audit-logs`).then(r => setAuditLogs(r.data));
        
        if (userId) {
          axios.get(`${BACKEND_URL}/api/bookings/history/${userId}`).then(r => setUserHistory(r.data));
        }
        if (!isSilent) setLoading(false);
      })
      .catch((err) => {
        console.error("Error synchronizing tracking data layers:", err);
        if (!isSilent) setLoading(false);
      });
  };

  useEffect(() => {
    if (user) {
      fetchAllData(user.id);
      
      // Fast polling: checks database every 2 seconds
      const liveUpdateInterval = setInterval(() => {
        fetchAllData(user.id, true); 
      }, 2000);

      return () => clearInterval(liveUpdateInterval);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    axios.post(`${BACKEND_URL}/api/auth/login`, { email, password })
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('app_user_session', JSON.stringify(res.data.user));
        alert(`Logged in successfully! Welcome back, ${res.data.user.name}`);
        fetchAllData(res.data.user.id);
      })
      .catch(() => alert("Login authentication failed! Check credentials."));
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const codeFromForm = e.target.elements.adminCodeField ? e.target.elements.adminCodeField.value : "";

    axios.post(`${BACKEND_URL}/api/auth/register`, { 
      name: regName, 
      email: email, 
      password: password,
      role: regRole,
      adminSecret: codeFromForm
    })
    .then(() => {
      alert("🎉 Secure Account created successfully! You can now log in.");
      setIsRegistering(false);
      setRegName('');
      setEmail('');
      setPassword('');
      fetchAllData(user?.id);
    })
    .catch((err) => {
      alert("🛑 " + (err.response?.data?.error || "Registration failed"));
    });
  };

  const handleAddAsset = (e) => {
    e.preventDefault();
    axios.post(`${BACKEND_URL}/api/assets`, { name: newName, category: newCategory, description: newDesc, quantityAvailable: Number(newQty), status: "Available" })
      .then(() => {
        alert("Asset added successfully!");
        setNewName(''); setNewCategory(''); setNewDesc(''); setNewQty(1);
        fetchAllData(user?.id);
      });
  };

  const startEditing = (asset) => {
    setEditingAssetId(asset._id);
    setEditName(asset.name);
    setEditCategory(asset.category);
    setEditDesc(asset.description);
    setEditQty(asset.quantityAvailable);
  };

  const handleUpdateAsset = (e) => {
    e.preventDefault();
    axios.put(`${BACKEND_URL}/api/assets/${editingAssetId}`, {
      name: editName,
      category: editCategory,
      description: editDesc,
      quantityAvailable: Number(editQty),
      status: Number(editQty) > 0 ? "Available" : "Out of Stock"
    })
    .then(() => {
      alert("Asset updated successfully!");
      setEditingAssetId(null);
      fetchAllData(user?.id);
    })
    .catch((err) => alert("Failed to update asset: " + err.response?.data?.error));
  };

  const handleDeleteAsset = (id) => {
    if (window.confirm("Are you certain you want to purge this asset document record?")) {
      axios.delete(`${BACKEND_URL}/api/assets/${id}`)
        .then(() => { alert("Asset removed!"); fetchAllData(user?.id); });
    }
  };

  const handleBookAsset = (assetId) => {
    if (!user) return alert("Please sign in first to submit reservation requests!");
    
    const duration = bookingDurations[assetId];
    if (!duration || !duration.start || !duration.end) {
      return alert("Please select a valid Start Date and End Date for your borrowing duration!");
    }

    const qtyToBook = parseInt(bookingQuantities[assetId]) || 1;

    axios.post(`${BACKEND_URL}/api/bookings`, { 
      userId: user.id, 
      assetId, 
      quantity: qtyToBook,
      startDate: duration.start, 
      endDate: duration.end 
    })
    .then(() => { 
      alert(`Allocation request logged successfully! Requested ${qtyToBook} unit(s).`); 
      fetchAllData(user.id); 
    })
    .catch((err) => alert(err.response?.data?.error || "Error booking item"));
  };

  const handleDurationChange = (assetId, field, value) => {
    setBookingDurations(prev => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] || {}),
        [field]: value
      }
    }));
  };

  const handleQuantityChange = (assetId, value) => {
    setBookingQuantities(prev => ({
      ...prev,
      [assetId]: value
    }));
  };

  const handleUpdateStatus = (bookingId, status) => {
    axios.put(`${BACKEND_URL}/api/bookings/${bookingId}/status`, { status })
      .then(() => { fetchAllData(user?.id); });
  };

  const filteredAssets = assets.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    if (selectedActionFilter === 'All Actions') return true;
    return log.action === selectedActionFilter;
  });

  // ================= STAGE 1: CLASSIC GATEWAY PORTAL =================
  if (!user) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#0f172a' }}>
        
        {/* Left Side Branding Screen */}
        <div style={{ flex: '1 1 400px', background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', color: '#fff', borderRight: '1px solid #1e293b' }}>
          <div style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '8px 16px', borderRadius: '20px', width: 'fit-content', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px' }}>
            🏢 Central Campus Command Node
          </div>
          <h1 style={{ fontSize: '42px', margin: 0, fontWeight: '800', lineHeight: '1.1', letterSpacing: '-1px' }}>IIT Roorkee Smart Asset Management</h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginTop: '15px', lineHeight: '1.6' }}>
            Enterprise Resource Allocation and Dynamic Inventory Optimization Suite. Log in to access lab trackers, submit logistics requests, and review operational audit logs.
          </p>
        </div>

        {/* Right Side Classic Entry Forms */}
        <div style={{ flex: '1 1 400px', maxWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#1e293b', padding: '50px', boxShadow: '-10px 0 30px rgba(0,0,0,0.2)' }}>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#fff', fontSize: '24px', margin: 0 }}>{isRegistering ? "Initialize Account" : "Secure System Access"}</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '5px 0 0 0' }}>{isRegistering ? "Fill campus credentials to register" : "Provide database authentication keys"}</p>
          </div>

          {!isRegistering ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>IITR Registered Email</label>
                <input type="email" placeholder="username@iitr.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Security Passphrase</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginTop: '10px' }}>Login</button>
              <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '15px' }}>
                New controller? <button type="button" onClick={() => setIsRegistering(true)} style={{ background: 'none', color: '#38bdf8', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}>Create Profile</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Full Name</label>
                <input type="text" placeholder="John Doe" value={regName} onChange={(e) => setRegName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>IITR Identity Email</label>
                <input type="email" placeholder="student@iitr.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Target Authority Node</label>
                <select value={regRole} onChange={(e) => setRegRole(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }}>
                  <option value="Consumer">Consumer User (Student)</option>
                  <option value="Admin">System Administrator (Faculty)</option>
                </select>
              </div>

              {regRole === 'Admin' && (
                <div>
                  <label style={{ color: '#ef4444', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Admin Code Passkey</label>
                  <input name="adminCodeField" type="password" placeholder="Enter Admin Code" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #ef4444', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }} required />
                </div>
              )}

              <button type="submit" style={{ width: '100%', padding: '11px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>Register User Profile</button>
              <button type="button" onClick={() => setIsRegistering(false)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer' }}>Return to Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ================= STAGE 2: CLASSIC DASHBOARD INTERFACE =================
  return (
    <div style={{ padding: '30px', fontFamily: 'Segoe UI, sans-serif', maxWidth: '1150px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER BAR */}
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#fff', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Asset Tracking & Optimization Node</h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.7, fontSize: '13px' }}>IIT Roorkee Smart Asset Management System</p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <span style={{ background: '#334155', padding: '6px 12px', borderRadius: '20px', fontSize: '13px' }}>⚙️ {user.name} ({user.role})</span>
          <button onClick={() => { 
            setUser(null); 
            setUserHistory([]); 
            localStorage.removeItem('app_user_session'); 
          }} style={{ background: 'none', color: '#ef4444', border: 'none', marginLeft: '10px', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Sign Out</button>
        </div>
      </div>

      {/* --- NEW TABBED NAVIGATION MENU --- */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <button onClick={() => setActiveTab('discover')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Discover Inventories</button>
        <button onClick={() => setActiveTab('issuance')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Issuance</button>
        <button onClick={() => setActiveTab('audit')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Audit Logs</button>
        
        {/* Hides Personal Log if the user is an Admin */}
        {user && user.role !== 'Admin' && (
          <button onClick={() => setActiveTab('personal')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Your Personal Log</button>
        )}
      </div>

      {/* The rest of your code (like the activeTab wrappers) will go right below this! */}

      {/* INSIGHTS SUMMARIES CARD NODES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #3b82f6' }}>
          <h4 style={{ margin: 0, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset Utilization Rate</h4>
          <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{dashboardData.summary.utilizationRate}%</p>
          <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ background: '#3b82f6', width: `${dashboardData.summary.utilizationRate}%`, height: '100%' }}></div>
          </div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #10b981' }}>
          <h4 style={{ margin: 0, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Allocations</h4>
          <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{dashboardData.summary.activeAllocations}</p>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #ef4444' }}>
          <h4 style={{ margin: 0, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Critical Overdue Returns</h4>
          <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{dashboardData.summary.overdueReturns}</p>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #f59e0b' }}>
          <h4 style={{ margin: 0, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tracked Pool</h4>
          <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#64748b' }}>{dashboardData.summary.totalAssets}</p>
        </div>
      </div>

      {/* METERS BREAKDOWN CHANNELS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e293b', textTransform: 'uppercase' }}>🔥 High-Demand Hotspots (Most Utilized)</h3>
          {dashboardData.topUtilized.length === 0 ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>Insufficient logs to rank utilization performance.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dashboardData.topUtilized.map((item, idx) => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>#{idx + 1} {item.name} <small style={{ color: '#94a3b8' }}>({item.category})</small></span>
                  <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{item.totalRequests} Handouts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e293b', textTransform: 'uppercase' }}>⚠️ Available Inventory Alerts (Low Units)</h3>
          {dashboardData.lowStockAlerts.length === 0 ? <p style={{ fontSize: '13px', color: '#10b981' }}>✅ All inventory channels are stable.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dashboardData.lowStockAlerts.map(item => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#fff1f2', borderRadius: '8px', borderLeft: '4px solid #f43f5e' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#9f1239' }}>{item.name}</span>
                  <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 'bold' }}>Only {item.quantityAvailable} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingAssetId && (
        <div style={{ background: '#fffbeb', padding: '20px', borderRadius: '12px', border: '1px solid #fcd34d', marginBottom: '25px' }}>
          <h3 style={{ marginTop: 0, color: '#b45309', fontSize: '16px' }}>📝 Modify Asset Information Form</h3>
          <form onSubmit={handleUpdateAsset} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="Asset Name" required />
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} required>
              <option value="Electronics">Electronics</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Lab Equipment">Lab Equipment</option>
            </select>
            <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }} placeholder="Specification Description" required />
            <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '80px' }} min="0" required />
            <button type="submit" style={{ background: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Apply Edits</button>
            <button type="button" onClick={() => setEditingAssetId(null)} style={{ background: '#cbd5e1', color: '#1e293b', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </form>
        </div>
      )}

      {/* CORE DISPLAY HOOK STREAM WINDOWS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
        <div>
          <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <input type="text" placeholder="Search asset name or info codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }}>
              <option value="All">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Lab Equipment">Lab Equipment</option>
            </select>
          </div>

          <h2 style={{ fontSize: '18px', color: '#334155', marginBottom: '15px' }}> Live Discoverable Inventory</h2>
          {loading && Object.keys(dashboardData.summary).length === 0 ? <p>Loading data layers...</p> : (
            <div>
              {filteredAssets.map(item => (
                <div key={item._id} style={{ background: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '12px', color: '#64748b', fontWeight: 'bold' }}>{item.category}</span>
                      <h3 style={{ margin: '5px 0', fontSize: '16px', color: '#1e293b' }}>{item.name}</h3>
                      {item.quantityAvailable < 1 && <HealthBadge status={item.healthStatus} />}
                      <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>{item.description}</p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', fontWeight: '500', color: item.quantityAvailable > 0 ? '#10b981' : '#ef4444' }}>Available Units: {item.quantityAvailable}</p>
                    </div>
                    {user && user.role === 'Admin' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => startEditing(item)} style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Edit Info</button>
                        <button onClick={() => handleDeleteAsset(item._id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Delete</button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                      <label>Start Date:</label>
                      <input type="date" onChange={(e) => handleDurationChange(item._id, 'start', e.target.value)} value={bookingDurations[item._id]?.start || ''} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                      <label>Return Due Date:</label>
                      <input type="date" onChange={(e) => handleDurationChange(item._id, 'end', e.target.value)} value={bookingDurations[item._id]?.end || ''} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                    
                    {/* 🆕 THE QUANTITY BOX */}
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                      <label>Req Qty:</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={item.quantityAvailable} 
                        value={bookingQuantities[item._id] || 1} 
                        onChange={(e) => handleQuantityChange(item._id, e.target.value)} 
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '50px' }} 
                      />
                    </div>

                    <button onClick={() => handleBookAsset(item._id)} style={{ padding: '6px 12px', background: item.quantityAvailable > 0 ? '#10b981' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', marginLeft: 'auto', cursor: item.quantityAvailable > 0 ? 'pointer' : 'not-allowed' }} disabled={item.quantityAvailable <= 0}>Submit Request</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {user && user.role === 'Admin' && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', color: '#1e293b' }}>Add New System Asset</h3>
              <form onSubmit={handleAddAsset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="text" placeholder="Asset Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }} required />
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }} required>
                  <option value="">Select Category</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Lab Equipment">Lab Equipment</option>
                </select>
                <input type="text" placeholder="Description Specification" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }} required />
                <input type="number" placeholder="Bulk Quantity" min="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }} required />
                <button type="submit" style={{ padding: '10px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Register Asset</button>
              </form>
            </div>
          )}

          {user && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', color: '#1e293b' }}> Your Personal Borrowing History</h3>
              {userHistory.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No record logs logged under this profile ticket.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {userHistory.map(h => (
                    <div key={h._id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                      <strong>{h.asset?.name || 'Purged Asset'} (Qty: {h.quantity || 1})</strong>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '500' }}>Due: {new Date(h.endDate).toLocaleDateString()}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: h.status === 'Returned' ? '#10b981' : '#f59e0b' }}>{h.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* OPERATIONS MANAGEMENT ADMIN PANEL GRID */}
      {user && user.role === 'Admin' && (
        <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', marginTop: '30px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, fontSize: '16px', color: '#1e293b' }}>🛡️ Enterprise Operations Authorization & Asset Issuance Logs</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>User</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Requested Item (Qty)</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Allocation Duration Window</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Status State</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px' }}>{b.user?.name}</td>
                    <td style={{ padding: '10px' }}>{b.asset?.name} (x{b.quantity || 1})</td>
                    <td style={{ padding: '10px', color: '#475569' }}>
                      {new Date(b.startDate).toLocaleDateString()} to <strong style={{ color: '#ef4444' }}>{new Date(b.endDate).toLocaleDateString()}</strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: b.status === 'Pending' ? '#fef3c7' : b.status === 'Approved' ? '#d1fae5' : '#f3f4f6', color: b.status === 'Pending' ? '#b45309' : b.status === 'Approved' ? '#065f46' : '#1f2937' }}>{b.status}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {b.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleUpdateStatus(b._id, 'Approved')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                          <button onClick={() => handleUpdateStatus(b._id, 'Rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                        </div>
                      )}
                      {b.status === 'Approved' && (
                        <button onClick={() => handleUpdateStatus(b._id, 'Returned')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Process Return</button>
                      )}
                      {b.status === 'Returned' && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Cycle Settled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= GLOBAL SECURITY AUDIT LOG TRAIL ================= */}
      {user && user.role === 'Admin' && (
        <div style={{ background: '#0f172a', color: '#cbd5e1', padding: '25px', borderRadius: '12px', marginTop: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Audit Log</h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>Showing {filteredAuditLogs.length} matching event logs</p>
            </div>
            
            <select 
              value={selectedActionFilter} 
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="All Actions">All Actions</option>
              <option value="USER REGISTERED">USER REGISTERED</option>
              <option value="USER LOGGED IN">USER LOGGED IN</option>
              <option value="ASSET BOOKED">ASSET BOOKED</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #1e293b', fontSize: '11px', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 8px' }}>Timestamp</th>
                  <th style={{ padding: '12px 8px' }}>User</th>
                  <th style={{ padding: '12px 8px' }}>Action</th>
                  <th style={{ padding: '12px 8px' }}>Entity</th>
                  <th style={{ padding: '12px 8px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map(log => (
                  <tr key={log._id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 8px', color: '#475569' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: '#6366f1', color: '#fff', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                          {log.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', color: '#f8fafc' }}>{log.username}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>{log.role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        background: log.action.includes('REGISTERED') ? 'rgba(16,185,129,0.1)' : log.action.includes('LOGIN') ? 'rgba(56,189,248,0.1)' : 'rgba(139,92,246,0.1)', 
                        color: log.action.includes('REGISTERED') ? '#10b981' : log.action.includes('LOGIN') ? '#38bdf8' : '#a78bfa', 
                        border: `1px solid ${log.action.includes('REGISTERED') ? 'rgba(16,185,129,0.2)' : log.action.includes('LOGIN') ? 'rgba(56,189,248,0.2)' : 'rgba(139,92,246,0.2)'}`, 
                        padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' 
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>{log.entity}</td>
                    <td style={{ padding: '12px 8px', color: '#64748b', fontStyle: 'italic', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;