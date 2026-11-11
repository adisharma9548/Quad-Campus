import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  Shield,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Button, Input, ShieldBanner, Card } from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';

export default function EduVerifyScreen({ onNext, onNavigate }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'verified'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(45);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Resend countdown timer
  useEffect(() => {
    let interval = null;
    if (step === 'otp' && resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendCountdown]);

  const validateEmail = (val) => {
    // Accepts college.edu.in, .edu, .ac.in
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu(\.in)?|ac\.in)$/i;
    return pattern.test(val.trim());
  };

  const handleEmailSubmit = (e) => {
    e?.preventDefault();
    const clean = email.trim();
    if (!clean) {
      setEmailError('Please enter your college email');
      return;
    }
    if (!validateEmail(clean)) {
      setEmailError('Please use your official college email (e.g. student@college.edu.in)');
      return;
    }
    setEmailError('');
    setStep('otp');
  };

  const handleAutofillDemo = () => {
    setEmail('aarav.patel@btech.college.edu.in');
    setEmailError('');
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');

    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleAutofillOtp = () => {
    setOtp(['8', '4', '2', '1']);
    setOtpError('');
  };

  const handleOtpSubmit = (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length < 4) {
      setOtpError('Please enter the full 4-digit code');
      return;
    }
    setOtpError('');
    setStep('verified');
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <QuadLogo size={42} showText tagline />
        <span className="text-xs px-3 py-1 rounded-full bg-ink/6 text-ink font-semibold border border-ink/12">
          Step 1 of 2
        </span>
      </div>

      {/* Main Form container */}
      <div className="my-auto py-6 max-w-md w-full mx-auto">
        <AnimatePresence mode="wait">
          {/* ──── STEP 1: EMAIL INPUT ──── */}
          {step === 'email' && (
            <motion.div
              key="email-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink font-display">
                  Verify your college status
                </h2>
                <p className="text-sm text-ink/60 mt-2 leading-relaxed">
                  Quad is exclusive to enrolled engineering students. Enter your college-issued email to confirm your access.
                </p>
              </div>

              {/* Crucial Privacy Assurance Banner */}
              <ShieldBanner
                type="info"
                icon={Lock}
                message="Zero-Leak Guarantee: Your email is used solely to verify enrollment. It is never displayed, shared, or tied to your public posts."
              />

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <Input
                  label="Campus Edu Email"
                  placeholder="rollno@college.edu.in"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  icon={Mail}
                  error={emailError}
                  helper="Must end with .edu.in or .ac.in"
                />

                {/* Quick test helper chip */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-ink/60">Testing mockup?</span>
                  <button
                    type="button"
                    onClick={handleAutofillDemo}
                    className="text-accent font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    Autofill sample .edu.in
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={ArrowRight}
                  className="mt-2"
                >
                  Send Verification Code
                </Button>

                <p className="text-[11px] text-center text-ink/60 pt-2 leading-relaxed">
                  By continuing, you agree to Quad's{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('terms')}
                    className="text-accent font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Terms & Conditions and Privacy Policy
                  </button>
                  .
                </p>
              </form>
            </motion.div>
          )}

          {/* ──── STEP 2: 4-DIGIT OTP ──── */}
          {step === 'otp' && (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-xs text-accent font-semibold mb-2 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  ← Change email
                </button>
                <h2 className="text-2xl font-bold tracking-tight text-ink font-display">
                  Enter 4-digit code
                </h2>
                <p className="text-sm text-ink/60 mt-1 leading-relaxed">
                  We sent a confirmation code to <br />
                  <span className="font-semibold text-ink">
                    {email}
                  </span>
                </p>
              </div>

              {/* OTP Input Boxes */}
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="flex justify-center gap-4 my-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-14 h-16 text-center text-2xl font-bold rounded-2xl border-2 border-ink/12 bg-canvas text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20 shadow-xs transition-all"
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-xs text-danger text-center font-semibold">{otpError}</p>
                )}

                {/* Helper to fill demo code */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleAutofillOtp}
                    className="text-xs text-accent font-semibold hover:underline cursor-pointer"
                  >
                    Fill demo code (8421)
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="mt-2"
                >
                  Confirm & Continue
                </Button>

                <div className="text-center pt-2">
                  <p className="text-xs text-ink/60">
                    {resendCountdown > 0 ? (
                      `Resend code in ${resendCountdown}s`
                    ) : (
                      <button
                        type="button"
                        onClick={() => setResendCountdown(45)}
                        className="text-accent font-semibold hover:underline cursor-pointer"
                      >
                        Resend code now
                      </button>
                    )}
                  </p>
                </div>
              </form>
            </motion.div>
          )}

          {/* ──── STEP 3: VERIFIED CELEBRATION ──── */}
          {step === 'verified' && (
            <motion.div
              key="verified-step"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-20 h-20 rounded-3xl bg-ink/6 border-2 border-accent text-accent flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={44} strokeWidth={2.2} />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink font-display">
                  Campus Status Verified!
                </h2>
                <p className="text-sm text-ink/60 mt-1 max-w-xs mx-auto leading-relaxed">
                  You are confirmed as an enrolled engineering student. Let's configure your pseudonymous profile.
                </p>
              </div>

              <Card className="text-left bg-canvas border border-ink/12 p-4">
                <div className="flex items-center gap-3">
                  <Shield className="text-accent flex-shrink-0" size={24} />
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Privacy Shield Activated
                    </p>
                    <p className="text-[11px] text-ink/60 mt-1">
                      Your real name and verified email are permanently locked in your private vault.
                    </p>
                  </div>
                </div>
              </Card>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => onNext?.()}
                className="mt-4"
              >
                Set Up Anonymous Profile →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Trust Indicator */}
      <div className="text-center text-[11px] text-ink/60 pt-4 border-t border-ink/12 flex items-center justify-center gap-2">
        <Lock size={12} className="text-ink" />
        <span>End-to-end pseudonymous campus network</span>
      </div>
    </div>
  );
}
