import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, User, Lock, Loader2, ShieldCheck, UserPlus, Eye, EyeOff } from 'lucide-react';

const Login = ({ onLoginSuccess, isInitialSetup }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isInitialSetup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role: 'Admin' } }
        });

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        alert('Administrative Officer account created successfully!');
        setLoading(false);
        window.location.href = window.location.origin;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          setLoading(false);
        } else {
          onLoginSuccess(data.session);
        }
      }
    } catch (err) {
      setError("A critical error occurred. Please check your internet connection and Supabase configuration.");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '450px', width: '90%', padding: '40px' }}>
        <div className="login-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <img 
            src="/basil-logo.avif" 
            alt="Logo" 
            style={{ width: '48px', height: '48px', borderRadius: '10px' }} 
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontWeight: 800 }}>
            BASIL INDUSTRIES LTD
          </p>
        </div>

        {isInitialSetup && (
          <div className="setup-alert" style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '10px', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <ShieldCheck size={18} />
            <span>Staff index empty. Initialize owner account.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '0' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: '40px', textAlign: 'center', letterSpacing: '0.05em' }}>
            {isInitialSetup ? 'SYSTEM INITIALIZATION' : 'ORDER TRUCKING SYSTEM'}
          </h2>

          {!isInitialSetup && (
            <div style={{ textAlign: 'left', marginBottom: '32px', borderLeft: '2px solid var(--accent-color)', paddingLeft: '10px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 800, letterSpacing: '0.1em' }}>SECURE LOGIN</span>
            </div>
          )}

          {error && <div className="login-error" style={{ color: 'var(--error)', marginBottom: '16px', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isInitialSetup && (
              <div className="form-group">
                <label style={{ fontSize: '0.65rem' }}>OFFICER NAME</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input required type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ paddingLeft: '40px' }} />
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label style={{ fontSize: '0.65rem' }}>ACCESS EMAIL</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input required type="email" placeholder="email@basil.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: '40px' }} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.65rem' }}>SECURITY PASS</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  required 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px', paddingRight: '45px' }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '32px', height: '44px', fontSize: '0.9rem' }} disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : (
              isInitialSetup ? 'AUTHORIZE INITIALIZATION' : 'SIGN IN TO SYSTEM'
            )}
          </button>
        </form>

        {!isInitialSetup && (
          <div className="login-footer" style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
             INDUSTRIAL SECURITY PROTOCOLS ACTIVE
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
