import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Shield, Mail, Phone, Trash2, ShieldAlert, MessageSquare, X, Eye, EyeOff, Edit3, Key, Save } from 'lucide-react';

const UserManagement = ({ profile }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  
  const [deleteComment, setDeleteComment] = useState('');
  const [filter, setFilter] = useState('All');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'Reception',
    phone: ''
  });

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: '',
    phone: '',
    newPassword: '' // Only for self
  });

  const filteredProfiles = profiles.filter(p => filter === 'All' || p.status === filter);
  const canManage = ['CEO', 'Admin', 'HR'].includes(profile?.role);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (e) => {
    e.preventDefault();
    if (!deleteComment) return alert('Comment is required for deactivation.');
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: 'Deactivated', 
          deactivation_reason: deleteComment 
        })
        .eq('id', showDeleteModal.id);
      
      if (error) throw error;
      
      alert(`Access for ${showDeleteModal.full_name} has been revoked.`);
      setShowDeleteModal(null);
      setDeleteComment('');
      fetchProfiles();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalRole = editFormData.role === 'Other' ? editFormData.customRole : editFormData.role;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.fullName,
          role: finalRole,
          phone: editFormData.phone
        })
        .eq('id', showEditModal.id);

      if (error) throw error;
      // ... same as before
      if (showEditModal.id === profile.id && editFormData.newPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: editFormData.newPassword
        });
        if (pwdError) throw pwdError;
        alert('Your profile and password have been updated.');
      } else {
        alert('Employee profile updated successfully.');
      }

      setShowEditModal(null);
      fetchProfiles();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalRole = formData.role === 'Other' ? formData.customRole : formData.role;
    
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: finalRole,
            phone: formData.phone
          }
        }
      });

      if (error) throw error;
      
      alert(`Account created for ${formData.fullName} as ${finalRole}.`);
      setShowAddModal(false);
      fetchProfiles();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inner-content">
      <header className="content-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Employee Management</h1>
          <p>Create and manage department access for Basil Industries Ltd staff.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="status-chips">
            <button className={`chip ${filter === 'Active' ? 'active' : ''}`} onClick={() => setFilter('Active')}>Active</button>
            <button className={`chip ${filter === 'Deactivated' ? 'active' : ''}`} onClick={() => setFilter('Deactivated')}>Inactive</button>
            <button className={`chip ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')}>All</button>
          </div>
          {canManage && (
            <button className="primary-btn" onClick={() => setShowAddModal(true)}>
              <UserPlus size={18} />
              Register New Employee
            </button>
          )}
        </div>
      </header>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '32px' }}>
        <div className="stat-card">
          <h3 className="stat-label">Total Staff</h3>
          <p className="stat-value">{profiles.length}</p>
        </div>
        <div className="stat-card">
          <h3 className="stat-label">Active Force</h3>
          <p className="stat-value" style={{ color: 'var(--accent-color)' }}>
            {profiles.filter(p => !p.status || p.status === 'Active').length}
          </p>
        </div>
        <div className="stat-card">
          <h3 className="stat-label">Inactive Records</h3>
          <p className="stat-value" style={{ color: 'var(--error)' }}>
            {profiles.filter(p => p.status === 'Deactivated').length}
          </p>
        </div>
      </div>

      <div className="table-card full-width">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Dept / Role</th>
              <th>Contact Info</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.map(p => (
              <tr key={p.id} className={p.status === 'Deactivated' ? 'row-inactive' : ''}>
                <td>
                   <div style={{ fontWeight: 600 }}>{p.full_name}</div>
                   {p.status === 'Deactivated' && <small style={{ color: 'var(--error)' }}>Revoked Access</small>}
                </td>
                <td>
                  <span className="phase-indicator" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>
                    <Shield size={14} style={{ marginRight: '8px' }} />
                    {p.role}
                  </span>
                </td>
                <td className="col-subtext">
                  <div><Mail size={12} /> {p.username}</div>
                  <div><Phone size={12} /> {p.phone || 'N/A'}</div>
                </td>
                <td>
                  <span className={`status-badge ${p.status === 'Deactivated' ? 'delayed' : 'completed'}`}>
                    {p.status === 'Deactivated' ? 'Inactive' : 'Active'}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className="icon-btn" 
                            title="Edit Profile"
                            onClick={() => {
                                setEditFormData({ fullName: p.full_name, role: p.role, phone: p.phone, newPassword: '' });
                                setShowEditModal(p);
                            }}
                        >
                            <Edit3 size={16} />
                        </button>

                        {p.status !== 'Deactivated' ? (
                        <button 
                            className="icon-btn" 
                            style={{ color: 'var(--error)' }}
                            onClick={() => setShowDeleteModal(p)}
                            title="Deactivate Staff"
                        >
                            <Trash2 size={16} />
                        </button>
                        ) : (
                        <button className="icon-btn" style={{ color: 'var(--accent-color)', opacity: 0.5 }} title="Already Deactivated">
                            <ShieldAlert size={16} />
                        </button>
                        )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '450px' }}>
                  <div className="modal-header">
                      <h2>Edit Employee Profile</h2>
                      <button className="close-btn" onClick={() => setShowEditModal(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleUpdateProfile}>
                      <div className="form-group">
                          <label>Full Name</label>
                          <input type="text" value={editFormData.fullName} onChange={e => setEditFormData({...editFormData, fullName: e.target.value})} />
                      </div>
                      <div className="form-group">
                          <label>Department / Role</label>
                          <select value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})}>
                            <option value="CEO">CEO</option>
                            <option value="Admin">Administrative Officer</option>
                            <option value="HR">HR Manager</option>
                            <option value="Reception">Reception</option>
                            <option value="Design">Design</option>
                            <option value="Production">Production</option>
                            <option value="Stock">Stock / Warehouse</option>
                            <option value="Dispatch">Dispatch</option>
                            <option value="Other">Other (Custom Role)</option>
                          </select>
                      </div>
                      
                      {editFormData.role === 'Other' && (
                          <div className="form-group" style={{ marginTop: '-10px' }}>
                              <label style={{ color: 'var(--accent-color)', fontSize: '0.75rem' }}>Specify Custom Role Name</label>
                              <input 
                                required 
                                type="text" 
                                placeholder="Enter role name..." 
                                onChange={e => setEditFormData({...editFormData, customRole: e.target.value})} 
                              />
                          </div>
                      )}
                      <div className="form-group">
                          <label>Phone Number</label>
                          <input type="text" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                      </div>

                      {showEditModal.id === profile.id ? (
                          <div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '10px', marginTop: '20px' }}>
                              <label style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Key size={14} /> Change YOUR Password
                              </label>
                              <input 
                                type="password" 
                                placeholder="Leave blank to keep current" 
                                value={editFormData.newPassword} 
                                onChange={e => setEditFormData({...editFormData, newPassword: e.target.value})} 
                              />
                              <small className="text-muted">You can only change your own password in the app.</small>
                          </div>
                      ) : (
                          <div className="tip-box" style={{ marginTop: '20px' }}>
                              <p className="tip-text" style={{ fontSize: '0.8rem' }}>
                                  <strong>Note:</strong> Due to security, to reset <strong>another person's</strong> password, please use the Supabase Auth Dashboard.
                              </p>
                          </div>
                      )}

                      <div className="modal-actions" style={{ marginTop: '20px' }}>
                          <button type="button" className="secondary-btn" onClick={() => setShowEditModal(null)}>Cancel</button>
                          <button type="submit" className="primary-btn">
                              <Save size={18} /> Update Profile
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Register New Employee</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input required type="text" placeholder="Employee Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email Address (Username)</label>
                <input required type="email" placeholder="email@basil.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    required 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Create a password" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    style={{ paddingRight: '45px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role / Department</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="CEO">CEO</option>
                    <option value="Admin">Administrative Officer</option>
                    <option value="HR">HR Manager</option>
                    <option value="Reception">Reception</option>
                    <option value="Design">Design</option>
                    <option value="Production">Production</option>
                    <option value="Stock">Stock / Warehouse</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="Other">Other (Custom Role)</option>
                  </select>
                </div>
                {formData.role === 'Other' && (
                  <div className="form-group">
                    <label style={{ color: 'var(--accent-color)' }}>Specify Role Name</label>
                    <input required type="text" placeholder="e.g. Electrician" onChange={e => setFormData({...formData, customRole: e.target.value})} />
                  </div>
                )}
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" placeholder="+250..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions" style={{ flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="primary-btn" style={{ width: '100%' }}>Create System Account</button>
                <button type="button" className="secondary-btn" style={{ width: '100%' }} onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--error)' }}>Revoke System Access</h2>
              <button className="close-btn" onClick={() => setShowDeleteModal(null)}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p>You are about to deactivate access for <strong>{showDeleteModal.full_name}</strong>.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                This is a secure action restricted to Executive and HR roles. A reason must be provided.
              </p>
            </div>
            <form onSubmit={handleDeactivate}>
              <div className="form-group">
                <label>Reason for Deactivation (Required)</label>
                <textarea 
                  required 
                  rows="4" 
                  placeholder="e.g., Left the company, Department change, etc."
                  style={{ width: '100%', background: 'var(--bg-color)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}
                  value={deleteComment}
                  onChange={e => setDeleteComment(e.target.value)}
                ></textarea>
              </div>
              <div className="modal-actions" style={{ flexDirection: 'column', gap: '12px' }}>
                <button type="submit" className="primary-btn" style={{ width: '100%', background: 'var(--error)' }}>Revoke Access Now</button>
                <button type="button" className="secondary-btn" style={{ width: '100%' }} onClick={() => setShowDeleteModal(null)}>Keep Employee Active</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
