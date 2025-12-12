import { useState } from 'react';
import { registerUser } from '../api/auth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setSuccess(false);

    if (!isEmailValid) {
      setErrorMessage('Invalid email format');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    try {
      await registerUser(email, password, name);
      setSuccess(true);
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  return (
    <div className="center-container">
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
          Register
        </h1>

        {errorMessage && (
          <p style={{ color: 'red', marginBottom: 12 }}>{errorMessage}</p>
        )}
        {success && (
          <p style={{ color: 'green', marginBottom: 12 }}>
            Account created!{' '}
            <a href="/login" style={{ color: 'black', fontWeight: 600 }}>
              Click here to log in
            </a>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {/* NAME */}
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Name (optional)</label>
            <input
              className="input"
              type="text"
              value={name}
              placeholder="John Doe"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
            Create account
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'black', fontWeight: 600 }}>
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
