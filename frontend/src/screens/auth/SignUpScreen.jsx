import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Lock,
  User,
  Mail,
  Calendar,
  AtSign,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, TextField, Avatar, Card, Modal } from '../../components/ui';
import { AuthSplitLayout } from '../../components/AuthSplitLayout';
import TermsPrivacyScreen from '../TermsPrivacyScreen';

// Official recognized engineering departments (compulsory full forms)
const OFFICIAL_DEPARTMENTS = [
  'Information Technology',
  'Computer Science & Engineering - Computer Science',
  'Computer Science & Engineering - Data Science',
  'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
  'Computer Science & Engineering - Internet of Things',
  'Civil Engineering',
  'Mechanical Engineering',
  'Electrical & Electronics Engineering',
  'Electronics & Communication Engineering',
];

const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Mock list of campus interest tags
const CAMPUS_INTERESTS = [
  'Algorithms & CP',
  'AI & Machine Learning',
  'Robotics & Embedded',
  'Web & Cloud Systems',
  'Cybersecurity',
  'UI/UX & Design',
  'Campus Hackathons',
  'Open Source',
];

// Mock list of recommended campus creators
const RECOMMENDED_PEERS = [
  {
    username: 'cyber_sage',
    fullName: 'Rohan Verma',
    initials: 'CS',
    branch: 'Computer Science & Engineering',
    year: '3rd Year',
    bio: 'Security researcher & cryptographer.',
  },
  {
    username: 'algo_ninja',
    fullName: 'Ananya Roy',
    initials: 'AN',
    branch: 'Computer Science & Engineering - Data Science',
    year: '2nd Year',
    bio: 'Competitive coding & graph theory.',
  },
  {
    username: 'debug_queen',
    fullName: 'Priya Sharma',
    initials: 'DQ',
    branch: 'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
    year: '4th Year',
    bio: 'Distributed systems & ML pipelines.',
  },
];

export default function SignUpScreen({ onNavigate }) {
  const { signUp, checkUsernameAvailable } = useAuth();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Form state preserved across steps
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    dob: '',
    department: '',
    year: '',
    section: '',
    username: '',
    bio: '',
    avatarInitials: '',
    interests: [],
    following: [],
    agreedToTerms: false,
  });

  // Touched state for onBlur validation
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});

  // Step 1 UI helpers
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 Username availability check state
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: '',
    suggestions: [],
  });

  // Form submission & legal modal state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Debounce ref for username check
  const usernameDebounceRef = useRef(null);

  // Mark field as touched on blur
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  // Field validator
  const validateField = (field, value) => {
    let error = '';

    if (field === 'email') {
      const trimmed = (value || '').trim();
      if (!trimmed) {
        error = 'College email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        error =
          'Please enter a valid college email address (e.g. student@college.edu.in). Mobile numbers are not permitted.';
      }
    }

    if (field === 'password') {
      if (!value) {
        error = 'Password is required.';
      } else if (value.length < 8) {
        error = 'Password must be at least 8 characters.';
      }
    }

    if (field === 'fullName') {
      if (!value || !value.trim()) {
        error = 'Legal student name is required.';
      }
    }

    if (field === 'dob') {
      if (!value) {
        error = 'Date of birth is required.';
      } else {
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (isNaN(age) || age < 13) {
          error = 'Quad is restricted to students 13 and older.';
        }
      }
    }

    if (field === 'department') {
      if (!value || !value.trim()) {
        error = 'Engineering department is compulsory. Please select your official department.';
      }
    }

    if (field === 'year') {
      if (!value || !value.trim()) {
        error = 'Academic year is compulsory. Choose 1st, 2nd, 3rd, or 4th Year.';
      }
    }

    if (field === 'section') {
      if (!value || !value.trim()) {
        error = 'Section selection is compulsory (Section A through H).';
      }
    }

    if (field === 'username') {
      const clean = (value || '').trim().toLowerCase();
      if (!clean) {
        error = 'Username is required.';
      } else if (clean.length < 3) {
        error = 'Username must be at least 3 characters.';
      } else if (!/^[a-z0-9_]+$/.test(clean)) {
        error = 'Only lowercase letters, numbers, and underscores allowed.';
      }
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  // Step 3: Debounced live username availability check
  useEffect(() => {
    const rawUser = formData.username.trim().toLowerCase();

    if (!rawUser || rawUser.length < 3 || !/^[a-z0-9_]+$/.test(rawUser)) {
      return;
    }

    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
    }

    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(rawUser);
        if (result.available) {
          setUsernameStatus({
            checking: false,
            available: true,
            message: `@${rawUser} is available!`,
            suggestions: [],
          });
          setErrors((prev) => ({ ...prev, username: '' }));
        } else {
          setUsernameStatus({
            checking: false,
            available: false,
            message: `@${rawUser} is not available.`,
            suggestions: result.suggestions || [],
          });
          setErrors((prev) => ({
            ...prev,
            username: `Username @${rawUser} is taken.`,
          }));
        }
      } catch {
        setUsernameStatus({
          checking: false,
          available: false,
          message: 'Error verifying username availability.',
          suggestions: [],
        });
      }
    }, 350);

    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
      }
    };
  }, [formData.username, checkUsernameAvailable]);

  // Derived monogram initials computed on the fly
  const derivedInitials = (() => {
    if (formData.avatarInitials) return formData.avatarInitials;
    if (!formData.fullName.trim()) return 'QD';
    const parts = formData.fullName.trim().split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  })();

  // Check if current step is valid to proceed
  const isCurrentStepValid = () => {
    if (currentStep === 1) {
      return (
        formData.email.trim().length > 0 &&
        formData.password.length >= 8 &&
        !errors.email &&
        !errors.password
      );
    }
    if (currentStep === 2) {
      return (
        formData.fullName.trim().length > 0 &&
        formData.dob.length > 0 &&
        formData.department.trim().length > 0 &&
        formData.year.trim().length > 0 &&
        formData.section.trim().length > 0 &&
        !errors.fullName &&
        !errors.dob &&
        !errors.department &&
        !errors.year &&
        !errors.section
      );
    }
    if (currentStep === 3) {
      return (
        formData.username.trim().length >= 3 &&
        /^[a-z0-9_]+$/.test(formData.username.trim().toLowerCase()) &&
        usernameStatus.available === true &&
        !usernameStatus.checking
      );
    }
    if (currentStep === 4) {
      return true; // Optional/skippable
    }
    if (currentStep === 5) {
      return true; // Optional/skippable
    }
    if (currentStep === 6) {
      return formData.agreedToTerms === true && !isSubmitting;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      const validEmail = validateField('email', formData.email);
      const validPass = validateField('password', formData.password);
      if (!validEmail || !validPass) {
        setTouched((prev) => ({ ...prev, email: true, password: true }));
        return;
      }
    }

    if (currentStep === 2) {
      const validName = validateField('fullName', formData.fullName);
      const validDob = validateField('dob', formData.dob);
      const validDept = validateField('department', formData.department);
      const validYear = validateField('year', formData.year);
      const validSec = validateField('section', formData.section);
      if (!validName || !validDob || !validDept || !validYear || !validSec) {
        setTouched((prev) => ({
          ...prev,
          fullName: true,
          dob: true,
          department: true,
          year: true,
          section: true,
        }));
        return;
      }
    }

    if (currentStep === 3) {
      if (!usernameStatus.available) {
        setTouched((prev) => ({ ...prev, username: true }));
        return;
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onNavigate?.('welcome');
    }
  };

  // Submit Final Registration
  const handleSubmit = async () => {
    if (!formData.agreedToTerms || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        dob: formData.dob,
        department: formData.department,
        year: formData.year,
        section: formData.section,
        username: formData.username,
        bio: formData.bio,
        avatarInitials: formData.avatarInitials || derivedInitials,
        interests: formData.interests,
        following: formData.following,
      });

      showToast(`Welcome to Quad, @${formData.username}!`, 'success');
      onNavigate?.('feed');
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5 helper: toggle interest
  const toggleInterest = (interest) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(interest);
      const updated = exists
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests: updated };
    });
  };

  // Step 5 helper: toggle following
  const toggleFollow = (username) => {
    setFormData((prev) => {
      const exists = prev.following.includes(username);
      const updated = exists
        ? prev.following.filter((u) => u !== username)
        : [...prev.following, username];
      return { ...prev, following: updated };
    });
  };

  return (
    <>
    <AuthSplitLayout
      compactMobileHeader
      footer="Verified college identities keep Quad safe and academic-only."
    >
      <Card className="p-6 sm:p-8 flex flex-col gap-6">
        {/* ── Top Navigation & Stepper Header ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] bg-ink/6 hover:bg-ink/12 text-ink text-xs font-semibold min-h-[44px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Go back to previous step"
            >
              <ChevronLeft size={16} />
              <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
            </button>

            <div className="text-center">
              <span className="text-xs font-mono font-semibold tracking-wider text-ink/60 uppercase">
                Step {currentStep} of {totalSteps}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('login')}
              className="text-xs font-semibold text-accent hover:underline px-2 py-2 min-h-[44px] flex items-center cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Log in
            </button>
          </div>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            className="w-full h-2 bg-ink/12 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-accent transition-all duration-250 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Stepper Content Container ── */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
          {/* ═════════ STEP 1: College Email & Password (No Phone Numbers) ═════════ */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                  Create your campus account
                </h2>
                <p className="text-sm text-ink/60 mt-1">
                  Start with your verified college email. Mobile phone numbers are strictly not permitted.
                </p>
              </div>

              <div className="space-y-4">
                <TextField
                  label="Verified College Email"
                  id="email"
                  name="email"
                  placeholder="student@btech.college.edu.in"
                  icon={Mail}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  onBlur={() => handleBlur('email')}
                  error={touched.email ? errors.email : ''}
                  helper="Strictly verified college email (.edu or campus domain). Never displayed to peers on feeds or profiles."
                  autoComplete="email"
                  inputMode="email"
                />

                <TextField
                  label="Password"
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  icon={Lock}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  onBlur={() => handleBlur('password')}
                  error={touched.password ? errors.password : ''}
                  helper="Use at least 8 characters with a mix of letters and numbers."
                  autoComplete="new-password"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-ink/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
              </div>

              {/* Password strength indicator badge */}
              {formData.password.length > 0 && (
                <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center justify-between text-xs">
                  <span className="text-ink/60">Password strength:</span>
                  <span
                    className={`font-bold ${
                      formData.password.length >= 8 ? 'text-accent' : 'text-ink/60'
                    }`}
                  >
                    {formData.password.length >= 12
                      ? 'Strong'
                      : formData.password.length >= 8
                      ? 'Adequate'
                      : 'Too short (min 8)'}
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* ═════════ STEP 2: Full Name, Age Gate & Academic Registry (Compulsory) ═════════ */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                  Student Verification & Academic Registry
                </h2>
                <p className="text-sm text-ink/60 mt-1">
                  Department, year, and section are compulsory and cryptographically locked to your college email.
                </p>
              </div>

              {/* Mandatory Permanent Binding Callout Notice */}
              <div className="p-4 rounded-[8px] bg-ink/6 border border-ink/12 flex items-start gap-3">
                <AlertCircle size={20} className="text-accent flex-shrink-0 mt-1" />
                <div className="text-xs text-ink/60 leading-relaxed space-y-1">
                  <p className="font-bold text-ink">
                    Permanent Academic Identity Notice
                  </p>
                  <p>
                    Your <strong>Department, Academic Year, and Section</strong> are linked directly to your verified college email and <strong>CANNOT be changed in future settings</strong>. Please ensure your academic credentials are accurate.
                  </p>
                  <p className="text-[11px] text-ink/40 pt-1 flex items-center gap-1">
                    <Lock size={12} className="inline text-accent" />
                    <span><strong>Privacy Guard:</strong> Your section is strictly private and is never shown on your public profile or posts.</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <TextField
                  label="Full Name (Legal Student Name)"
                  id="fullName"
                  name="fullName"
                  placeholder="e.g. Aarav Patel"
                  icon={User}
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  onBlur={() => handleBlur('fullName')}
                  error={touched.fullName ? errors.fullName : ''}
                  helper="Used strictly for internal college registry verification. Never displayed on public feeds."
                  autoComplete="name"
                />

                <TextField
                  label="Date of Birth"
                  id="dob"
                  name="dob"
                  type="date"
                  icon={Calendar}
                  value={formData.dob}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dob: e.target.value }))
                  }
                  onBlur={() => handleBlur('dob')}
                  error={touched.dob ? errors.dob : ''}
                  helper="Must be 13 years of age or older to join the campus network."
                  autoComplete="bday"
                />

                {/* 1. Compulsory Department Selector (Full Forms) */}
                <div className="space-y-2">
                  <label
                    htmlFor="departmentSelect"
                    className="block text-xs font-semibold tracking-wide uppercase text-ink/60"
                  >
                    Engineering Department <span className="text-accent font-bold">*Compulsory</span>
                  </label>
                  <div className="relative">
                    <select
                      id="departmentSelect"
                      name="department"
                      value={formData.department}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({ ...prev, department: val }));
                        validateField('department', val);
                      }}
                      onBlur={() => handleBlur('department')}
                      aria-invalid={Boolean(touched.department && errors.department)}
                      className={`w-full min-h-[44px] rounded-[8px] border bg-canvas px-3 py-2 text-sm text-ink transition-all appearance-none cursor-pointer ${
                        touched.department && errors.department
                          ? 'border-danger focus:ring-2 focus:ring-danger/20 text-danger'
                          : 'border-ink/12 hover:border-ink/24 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
                      }`}
                    >
                      <option value="">Select your official engineering department...</option>
                      {OFFICIAL_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 text-xs">
                      ▼
                    </div>
                  </div>
                  {touched.department && errors.department ? (
                    <p className="text-xs text-danger font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{errors.department}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink/60">
                      Permanent: Linked to your email and cannot be changed later.
                    </p>
                  )}
                </div>

                {/* 2. Compulsory Academic Year Selector (1st, 2nd, 3rd, 4th) */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-semibold tracking-wide uppercase text-ink/60">
                    Academic Year <span className="text-accent font-bold">*Compulsory</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ACADEMIC_YEARS.map((yr) => {
                      const isSelected = formData.year === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, year: yr }));
                            setTouched((prev) => ({ ...prev, year: true }));
                            setErrors((prev) => ({ ...prev, year: '' }));
                          }}
                          className={`min-h-[44px] px-3 py-2 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isSelected
                              ? 'bg-ink text-canvas border border-ink shadow-xs'
                              : 'bg-ink/6 text-ink hover:bg-ink/12 border border-ink/12'
                          }`}
                        >
                          {isSelected && <Check size={14} strokeWidth={2.5} />}
                          <span>{yr}</span>
                        </button>
                      );
                    })}
                  </div>
                  {touched.year && errors.year && (
                    <p className="text-xs text-danger font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{errors.year}</span>
                    </p>
                  )}
                </div>

                {/* 3. Compulsory Section Selector (A through H) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold tracking-wide uppercase text-ink/60">
                      Class Section <span className="text-accent font-bold">*Compulsory</span>
                    </label>
                    <span className="text-[11px] font-medium text-ink/60 flex items-center gap-1">
                      <Lock size={11} className="text-accent" />
                      <span>Private to You</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {SECTIONS.map((sec) => {
                      const isSelected = formData.section === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, section: sec }));
                            setTouched((prev) => ({ ...prev, section: true }));
                            setErrors((prev) => ({ ...prev, section: '' }));
                          }}
                          className={`min-h-[44px] px-2 py-2 rounded-[8px] text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'bg-ink text-canvas border border-ink shadow-xs'
                              : 'bg-ink/6 text-ink hover:bg-ink/12 border border-ink/12'
                          }`}
                        >
                          {sec}
                        </button>
                      );
                    })}
                  </div>
                  {touched.section && errors.section ? (
                    <p className="text-xs text-danger font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{errors.section}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink/60">
                      Sections A to H. Used privately for internal classmate filters; never displayed on public feeds or profiles.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═════════ STEP 3: Choose Username with Live Availability ═════════ */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                  Pick your campus handle
                </h2>
                <p className="text-sm text-ink/60 mt-1">
                  This pseudonym is how campus peers will recognize and interact with you.
                </p>
              </div>

              <div className="space-y-4">
                <TextField
                  label="Campus Username"
                  id="username"
                  name="username"
                  placeholder="e.g. quantum_dev"
                  icon={AtSign}
                  value={formData.username}
                  onChange={(e) => {
                    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setFormData((prev) => ({ ...prev, username: cleaned }));
                    if (cleaned.length >= 3) {
                      setUsernameStatus((prev) => ({ ...prev, checking: true, message: '' }));
                    } else {
                      setUsernameStatus({ checking: false, available: null, message: '', suggestions: [] });
                    }
                  }}
                  onBlur={() => handleBlur('username')}
                  error={touched.username ? errors.username : ''}
                  loading={usernameStatus.checking}
                  helper="Lowercase letters, numbers, and underscores only. Minimum 3 characters."
                  autoComplete="off"
                  rightElement={
                    !usernameStatus.checking && usernameStatus.available === true ? (
                      <div className="flex items-center text-accent" title="Username available">
                        <Check size={18} strokeWidth={2.5} />
                      </div>
                    ) : null
                  }
                />

                {/* Live Availability Status Display */}
                {usernameStatus.message && (
                  <p
                    className={`text-xs font-semibold flex items-center gap-2 ${
                      usernameStatus.available ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {usernameStatus.available ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    <span>{usernameStatus.message}</span>
                  </p>
                )}

                {/* Suggestions if taken */}
                {usernameStatus.suggestions.length > 0 && (
                  <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 space-y-2">
                    <p className="text-xs text-ink/60 font-medium">Available suggestions:</p>
                    <div className="flex flex-wrap gap-2">
                      {usernameStatus.suggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, username: sug }));
                            setTouched((prev) => ({ ...prev, username: true }));
                          }}
                          className="px-3 py-1 rounded-[8px] bg-canvas border border-ink/12 hover:border-accent text-xs font-mono font-semibold text-ink transition-colors cursor-pointer"
                        >
                          @{sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═════════ STEP 4: Profile Avatar & Bio (Optional) ═════════ */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                    Profile Identity
                  </h2>
                  <p className="text-sm text-ink/60 mt-1">
                    Customize your avatar monogram and campus bio. (Optional)
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink/60">
                  Skippable
                </span>
              </div>

              {/* Avatar Monogram Preview */}
              <div className="flex items-center gap-4 p-4 rounded-[8px] bg-ink/6 border border-ink/12">
                <Avatar
                  initials={formData.avatarInitials || derivedInitials}
                  size="xl"
                  showBadge
                  badgeType="private"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Monogram Badge
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder={derivedInitials}
                      value={formData.avatarInitials}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          avatarInitials: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-14 h-10 text-center font-mono font-bold text-sm bg-canvas border border-ink/12 rounded-[8px] text-ink focus:border-accent focus:outline-none"
                      aria-label="Monogram initials"
                    />
                    <span className="text-xs text-ink/60">2-letter badge initials</span>
                  </div>
                </div>
              </div>

              {/* Bio Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bio"
                    className="block text-xs font-semibold tracking-wide uppercase text-ink/60"
                  >
                    Campus Bio
                  </label>
                  <span className="text-xs font-mono text-ink/60">
                    {formData.bio.length}/150
                  </span>
                </div>
                <textarea
                  id="bio"
                  name="bio"
                  maxLength={150}
                  rows={3}
                  placeholder="e.g. 2nd year B.Tech studying systems and networks. Interested in hackathons."
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  className="w-full rounded-[8px] border border-ink/12 bg-canvas p-3 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                />
              </div>
            </motion.div>
          )}

          {/* ═════════ STEP 5: Interests & Follows (Optional) ═════════ */}
          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                    Interests & Peer Follows
                  </h2>
                  <p className="text-sm text-ink/60 mt-1">
                    Pick your engineering passions and follow active campus builders.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink/60">
                  Skippable
                </span>
              </div>

              {/* Interests Chips */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold tracking-wide uppercase text-ink/60">
                  Select Interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAMPUS_INTERESTS.map((item) => {
                    const selected = formData.interests.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleInterest(item)}
                        className={`px-3 py-2 rounded-[8px] text-xs font-semibold min-h-[44px] transition-all cursor-pointer ${
                          selected
                            ? 'bg-ink text-canvas'
                            : 'bg-ink/6 text-ink hover:bg-ink/12 border border-ink/12'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Peers to Follow */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold tracking-wide uppercase text-ink/60">
                  Recommended Campus Peers
                </label>
                <div className="space-y-2">
                  {RECOMMENDED_PEERS.map((peer) => {
                    const isFollowing = formData.following.includes(peer.username);
                    return (
                      <div
                        key={peer.username}
                        className="flex items-center justify-between p-3 rounded-[8px] bg-canvas border border-ink/12"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar initials={peer.initials} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-ink truncate">
                              @{peer.username}
                            </p>
                            <p className="text-[11px] text-ink/60 truncate">
                              {peer.branch} • {peer.year}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant={isFollowing ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => toggleFollow(peer.username)}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═════════ STEP 6: Review, Terms & Finalize ═════════ */}
          {currentStep === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                  Finalize your Quad account
                </h2>
                <p className="text-sm text-ink/60 mt-1">
                  Please review your campus privacy commitments before proceeding.
                </p>
              </div>

              {/* Review card */}
              <Card variant="elevated" className="space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-ink/12">
                  <Avatar initials={formData.avatarInitials || derivedInitials} size="md" />
                  <div>
                    <p className="text-sm font-bold text-ink">@{formData.username}</p>
                    <p className="text-xs text-ink/60">{formData.fullName}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-ink/60">
                  <div className="flex justify-between">
                    <span>College Email:</span>
                    <span className="font-semibold text-ink font-mono">
                      {formData.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="shrink-0">Department:</span>
                    <span className="font-semibold text-ink text-right truncate" title={formData.department}>
                      {formData.department}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Academic Year & Section:</span>
                    <span className="font-semibold text-ink">
                      {formData.year} • Section {formData.section} (Private)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Account Binding:</span>
                    <span className="font-bold text-accent">Permanent (Locked to Email)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vault privacy:</span>
                    <span className="font-bold text-accent">Private by Default</span>
                  </div>
                </div>
              </Card>

              {/* Terms Checkbox */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <input
                    id="agreedToTermsCheckbox"
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        agreedToTerms: e.target.checked,
                      }))
                    }
                    className="mt-1 w-4 h-4 rounded border-ink/24 text-accent focus:ring-accent cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-ink/60 leading-relaxed select-none">
                    <label htmlFor="agreedToTermsCheckbox" className="cursor-pointer">
                      I confirm that I am a verified engineering student and agree to the{' '}
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      className="text-accent font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[4px]"
                    >
                      Terms & Conditions and Privacy Policy
                    </button>
                    <label htmlFor="agreedToTermsCheckbox" className="cursor-pointer">
                      . I understand my department, academic year, and section are permanently bound to my verified college email and cannot be changed in settings.
                    </label>
                  </span>
                </div>
              </div>

              {/* Submission error callout */}
              {submitError && (
                <div className="p-3 rounded-[8px] bg-danger/10 border border-danger text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* ── Stepper Navigation Footer Buttons ── */}
        <div className="pt-6 border-t border-ink/12 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              variant="secondary"
              size="md"
              icon={ChevronLeft}
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <div className="flex items-center gap-2">
              {(currentStep === 4 || currentStep === 5) && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={isSubmitting}
                >
                  Skip
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                icon={ChevronRight}
                onClick={handleNext}
                disabled={!isCurrentStepValid()}
              >
                Continue
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={UserPlus}
              loading={isSubmitting}
              onClick={handleSubmit}
              disabled={!formData.agreedToTerms || isSubmitting}
            >
              Create account
            </Button>
          )}
        </div>
      </Card>
    </AuthSplitLayout>

      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms & Conditions and Privacy Policy"
        description="Review Quad's campus privacy protections and student code of conduct before finishing sign-up."
        size="xl"
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1 scrollbar-hover">
          <TermsPrivacyScreen
            embedded
            onAgree={() => {
              setFormData((prev) => ({ ...prev, agreedToTerms: true }));
              setShowTermsModal(false);
            }}
            onBack={() => setShowTermsModal(false)}
          />
        </div>
      </Modal>
    </>
  );
}
