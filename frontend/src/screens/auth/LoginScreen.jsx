import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, TextField, Card } from '../../components/ui';
import { AuthSplitLayout } from '../../components/AuthSplitLayout';

export default function LoginScreen({ onNavigate }) {
  const { logIn } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [touched, setTouched] = useState({ identifier: false, password: false });
  const [errors, setErrors] = useState({ identifier: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, field === 'identifier' ? identifier : password);
  };

  const validateField = (field, value) => {
    let error = '';
    const trimmed = (value || '').trim();

    if (field === 'identifier') {
      if (!trimmed) {
        error = 'Campus username or verified college email is required.';
      }
    }

    if (field === 'password') {
      if (!value) {
        error = 'Password is required.';
      }
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  const isFormValid =
    identifier.trim().length > 0 &&
    password.length > 0 &&
    !errors.identifier &&
    !errors.password;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const validId = validateField('identifier', identifier);
    const validPass = validateField('password', password);
    if (!validId || !validPass) {
      setTouched({ identifier: true, password: true });
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setLoginError('');

    try {
      const result = await logIn({ identifier, password });
      showToast(`Welcome back, @${result.user.username}!`, 'success');
      onNavigate?.('feed');
    } catch (err) {
      // Non-enumerating error message to prevent user enumeration
      setLoginError(
        err.message ||
          'Invalid credentials. Please verify your login details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill demo helper
  const fillSeedAccount = () => {
    setIdentifier('quantum_dev');
    setPassword('Campus@2026');
    setErrors({ identifier: '', password: '' });
    setTouched({ identifier: true, password: true });
    setLoginError('');
  };

  return (
    <AuthSplitLayout
      compactMobileHeader
      footer="Quad protects student safety. Passwords are encrypted with SHA-256 and never stored in plaintext."
    >
      <Card className="p-6 sm:p-8 space-y-6">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight font-display">
              Log in to Quad
            </h2>
            <p className="text-sm text-ink/60 mt-1">
              Access your verified campus space and private vault.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('welcome')}
            aria-label="Back to welcome screen"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-[8px] text-ink/60 hover:text-ink hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={20} />
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Campus Handle or Verified College Email"
            id="loginIdentifier"
            name="identifier"
            placeholder="e.g. quantum_dev or aarav@btech.college.edu.in"
            icon={User}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (loginError) setLoginError('');
            }}
            onBlur={() => handleBlur('identifier')}
            error={touched.identifier ? errors.identifier : ''}
            helper="Mobile numbers are not accepted. Use your college email or pseudonym."
            autoComplete="username"
            disabled={isLoading}
          />

          <div className="space-y-1">
            <TextField
              label="Password"
              id="loginPassword"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your account password"
              icon={Lock}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (loginError) setLoginError('');
              }}
              onBlur={() => handleBlur('password')}
              error={touched.password ? errors.password : ''}
              autoComplete="current-password"
              disabled={isLoading}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate?.('forgot_password')}
                className="text-xs font-semibold text-accent hover:underline cursor-pointer px-2 min-h-[44px] flex items-center rounded-[8px]"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {/* Form-level Error Message */}
          {loginError && (
            <div
              role="alert"
              className="p-3 rounded-[8px] bg-danger/10 border border-danger text-danger text-xs font-semibold flex items-start gap-2 leading-relaxed"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-1" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              icon={LogIn}
              loading={isLoading}
              disabled={!isFormValid || isLoading}
            >
              Log in
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => onNavigate?.('signup')}
              disabled={isLoading}
            >
              New here? Create an account
            </Button>
          </div>
        </form>

        {/* Demo Fast Login Callout */}
        <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span>Demo Quick-Fill Account</span>
            </span>
            <button
              type="button"
              onClick={fillSeedAccount}
              className="text-accent font-semibold hover:underline cursor-pointer px-2 min-h-[44px] flex items-center rounded-[8px]"
            >
              Use demo credentials
            </button>
          </div>
          <p className="text-ink/60 leading-relaxed">
            Identifier: <code className="font-mono text-ink font-semibold">quantum_dev</code> • Password:{' '}
            <code className="font-mono text-ink font-semibold">Campus@2026</code>
          </p>
        </div>
      </Card>
    </AuthSplitLayout>
  );
}
