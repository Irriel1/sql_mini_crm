import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');

    try {
      await login(email, password);
      window.location.href = '/'; // redirect to dashboard/root
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <div className="center-container">
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>Login</h1>

        {err && <p style={{ color: 'red' }}>{err}</p>}


        <form onSubmit={handleSubmit}>
          {/* EMAIL */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
            {email && !isEmailValid && (
              <p style={{ color: 'red', fontSize: 13, marginTop: 4 }}>
                Invalid email format
              </p>
            )}
          </div>

          {/* PASSWORD */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#555',
                  userSelect: 'none',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </span>
            </div>
          </div>

          {/* SUBMIT */}
          <button type="submit" className="button" style={{ marginTop: 8 }}>
            Sign in
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Don't have an account?{' '}
          <a href="/register" style={{ color: 'black', fontWeight: 600 }}>
            Register here
          </a>
        </p>
      </div>
    </div>
  );
}