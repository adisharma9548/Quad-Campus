import React, { useState } from 'react';
import {
  ChevronLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, TextField, Card } from '../../components/ui';
import { AuthSplitLayout } from '../../components/AuthSplitLayout';

export default function ForgotPasswordScreen({ onNavigate }) {
  const { requestPasswordReset } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleBlur = () => {
    setTouched(true);
    validate(identifier);
  };

  const validate = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      setError('Please enter your campus handle or verified college email.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validate(identifier) || isLoading) return;

    setIsLoading(true);

    try {
      const res = await requestPasswordReset(identifier);
      setIsSubmitted(true);
      setSubmitMessage(
        res.message ||
          'If an account exists with this credential, password reset instructions have been dispatched.'
      );
    } catch (err) {
      setError(err.message || 'Failed to dispatch reset request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      compactMobileHeader
      footer="Quad account security protects against credential stuffing and automated enumeration attacks."
    >
      <Card className="p-6 sm:p-8 space-y-6">
        {/* Card Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate?.('login')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] bg-ink/6 hover:bg-ink/12 text-ink text-xs font-semibold min-h-[44px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to login"
          >
            <ChevronLeft size={16} />
            <span>Back to Log in</span>
          </button>

          <span className="inline-flex items-center px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-xs font-semibold text-ink">
            Account Recovery
          </span>
        </div>

        {/* Main Content */}
        {!isSubmitted ? (
          <div className="space-y-6">
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="w-12 h-12 rounded-full bg-ink/6 border border-ink/12 flex items-center justify-center text-accent mb-3">
                <KeyRound size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight font-display">
                Reset your password
              </h2>
              <p className="text-sm text-ink/60 mt-1">
                Enter your campus handle or verified college email to receive reset instructions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label="College Email or Campus Handle"
                id="resetIdentifier"
                name="identifier"
                placeholder="e.g. aarav@btech.college.edu.in or quantum_dev"
                icon={Mail}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError('');
                }}
                onBlur={handleBlur}
                error={touched ? error : ''}
                helper="We'll send a cryptographic one-time reset link to your verified college inbox. Mobile numbers are not permitted."
                autoComplete="username"
                disabled={isLoading}
              />

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-[8px] bg-danger/10 border border-danger text-danger text-xs font-semibold flex items-center gap-2"
                >
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  disabled={!identifier.trim() || isLoading}
                >
                  Send reset link
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 border border-accent flex items-center justify-center text-accent">
              <CheckCircle2 size={24} />
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight font-display">
              Instructions Dispatched
            </h2>

            <div className="p-4 rounded-[16px] bg-ink/6 border border-ink/12 text-xs text-ink/60 leading-relaxed text-left">
              <p className="font-semibold text-ink mb-1">Privacy-Preserving Reset:</p>
              <p>{submitMessage}</p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={() => onNavigate?.('login')}
              >
                Return to Log in
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AuthSplitLayout>
  );
}
