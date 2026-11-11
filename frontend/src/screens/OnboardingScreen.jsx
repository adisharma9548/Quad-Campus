import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Lock, Eye, Shield, Sparkles } from 'lucide-react';
import { Button, Card, Avatar } from '../components/ui';
import { useApp } from '../context/AppContext';

const AVATAR_PALETTES = [
  { id: 'tint', label: 'Canvas Tint', bg: 'bg-ink/6', text: 'text-ink', border: 'border-ink/12' },
  { id: 'solid', label: 'Solid Ink', bg: 'bg-ink', text: 'text-canvas', border: 'border-ink' },
  { id: 'accent', label: 'Campus Accent', bg: 'bg-accent', text: 'text-canvas', border: 'border-accent' },
  { id: 'subtle', label: 'Outline', bg: 'bg-canvas', text: 'text-ink', border: 'border-ink/20' },
];

const BRANCHES = ['IT', 'DS', 'AI/ML', 'CSE', 'IoT', 'ME', 'CE', 'First Year'];
const YEARS = ['1st', '2nd', '3rd', '4th'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const PRIVACY_CARDS = [
  {
    icon: Lock,
    title: 'Your profile is private by default',
    description: 'Only people you approve can see your posts and profile.',
  },
  {
    icon: Eye,
    title: 'You control who finds you',
    description: "Discovery is off by default. Turn it on when you're ready.",
  },
  {
    icon: Shield,
    title: 'Your identity is protected',
    description: 'No real names, no branch, no year shown publicly. Just your username.',
  },
];

export default function OnboardingScreen({ onNext }) {
  const { updateState } = useApp();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [selectedPalette, setSelectedPalette] = useState('tint');
  const [customInitials, setCustomInitials] = useState('');
  const usernameTimer = useRef(null);

  // Step 2 state
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');

  // Step 3 state
  const [privacyCardIndex, setPrivacyCardIndex] = useState(0);

  const deriveInitials = (uname) => {
    if (!uname) return 'QD';
    const parts = uname.split(/[_\-\s.]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return uname.slice(0, 2).toUpperCase() || 'QD';
  };

  const displayInitials = customInitials ? customInitials.toUpperCase().slice(0, 2) : deriveInitials(username);

  /* ─── Username Availability Mock ─── */
  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(val);
    setUsernameStatus(null);
    clearTimeout(usernameTimer.current);

    if (val.length >= 3) {
      setUsernameStatus('checking');
      usernameTimer.current = setTimeout(() => {
        const takenNames = ['admin', 'campus_shield', 'test', 'user'];
        setUsernameStatus(takenNames.includes(val) ? 'taken' : 'available');
      }, 800);
    }
  };

  const canProceedStep1 = username.length >= 3 && usernameStatus === 'available';
  const canProceedStep2 = branch && year;

  const goNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      updateState({
        username: username || 'cyber_sage',
        userInitials: displayInitials || 'CS',
        branch: branch || 'CSE',
        year: year || '3rd',
        section: section || 'A',
        onboardingComplete: true,
      });
      onNext?.();
    }
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const pageVariants = {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-ink/12">
        <motion.div
          className="h-full bg-accent rounded-r-full"
          initial={{ width: '0%' }}
          animate={{ width: `${(step / 3) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        {step > 1 ? (
          <button
            onClick={goBack}
            className="p-2 -ml-2 rounded-xl hover:bg-ink/8 text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <span className="text-sm font-medium text-ink/60">
          Step {step} of 3
        </span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto max-w-xl w-full mx-auto">
        <AnimatePresence mode="wait">
          {/* ═══════════ STEP 1: Username & Avatar ═══════════ */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-2xl font-bold text-ink font-display">
                Create your identity
              </h1>
              <p className="text-ink/60 mt-1 text-sm">
                Pick a username and avatar. This is how others see you.
              </p>

              {/* Username input */}
              <div className="mt-6 space-y-2">
                <label className="text-sm font-medium text-ink">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 text-sm font-medium">@</span>
                  <input
                    type="text"
                    placeholder="your_username"
                    value={username}
                    onChange={handleUsernameChange}
                    maxLength={20}
                    className="w-full rounded-[12px] border border-ink/12 bg-canvas pl-8 pr-8 py-3 text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                  {/* Status indicator */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && (
                      <motion.div
                        className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    {usernameStatus === 'available' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                        <Check size={20} className="text-accent" />
                      </motion.div>
                    )}
                    {usernameStatus === 'taken' && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-danger text-sm font-semibold">
                        Taken
                      </motion.span>
                    )}
                  </div>
                </div>
                {usernameStatus === 'available' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-accent font-semibold">
                    @{username} is available!
                  </motion.p>
                )}
                {usernameStatus === 'taken' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-danger font-semibold">
                    This username is already taken. Try another.
                  </motion.p>
                )}
              </div>

              {/* Avatar Monogram & Palette */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-ink">
                    Avatar Monogram & Theme
                  </label>
                  <span className="text-[11px] text-ink/60">Zero cartoon avatars</span>
                </div>
                <p className="text-xs text-ink/60 mb-3">
                  Quad uses neutral 2-letter monogram initials to eliminate profile stalking and visual profiling.
                </p>

                {/* Monogram Initials Input */}
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-canvas border border-ink/12">
                  <div className={`w-14 h-14 rounded-2xl ${AVATAR_PALETTES.find(p => p.id === selectedPalette)?.bg || 'bg-ink/6'} ${AVATAR_PALETTES.find(p => p.id === selectedPalette)?.text || 'text-ink'} border ${AVATAR_PALETTES.find(p => p.id === selectedPalette)?.border || 'border-ink/12'} flex items-center justify-center font-display text-lg font-bold shadow-xs flex-shrink-0`}>
                    {displayInitials}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-ink/60">
                      Initials (2 letters)
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={customInitials}
                      onChange={(e) => setCustomInitials(e.target.value.toUpperCase())}
                      placeholder={displayInitials}
                      className="w-20 px-3 py-1 text-center font-bold font-mono tracking-widest text-sm rounded-lg border border-ink/12 bg-canvas text-ink uppercase focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                {/* Color Palettes */}
                <div className="mt-4">
                  <label className="text-xs font-semibold text-ink/60 block mb-2">
                    Select Avatar Palette
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {AVATAR_PALETTES.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setSelectedPalette(pal.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          selectedPalette === pal.id
                            ? 'border-accent bg-ink/6 text-ink ring-1 ring-accent font-semibold'
                            : 'border-ink/12 bg-canvas text-ink hover:bg-ink/8'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${pal.bg} ${pal.border} border`} />
                        <span className="truncate">{pal.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              {canProceedStep1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center gap-4 p-4 bg-canvas rounded-2xl border border-ink/12"
                >
                  <Avatar initials={displayInitials} size="lg" showBadge badgeType="private" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-ink">@{username}</p>
                      <span className="text-[10px] px-2 py-1 rounded-md bg-ink/6 text-ink font-semibold border border-ink/12">
                        Private Vault
                      </span>
                    </div>
                    <p className="text-xs text-ink/60 mt-1">
                      Your identity is pseudonymous. No real name or email is ever attached.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="mt-auto pt-6">
                <Button fullWidth size="lg" onClick={goNext} disabled={!canProceedStep1}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══════════ STEP 2: Branch, Year, Section ═══════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-2xl font-bold text-ink font-display">
                Tell us about you
              </h1>
              <p className="text-ink/60 mt-1 text-sm">
                This helps us personalize your experience.
              </p>

              {/* Branch */}
              <div className="mt-6">
                <label className="text-sm font-medium text-ink">
                  Branch
                </label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBranch(b)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                        branch === b
                          ? 'bg-ink text-canvas font-bold'
                          : 'bg-ink/8 text-ink hover:bg-ink/12'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year */}
              <div className="mt-6">
                <label className="text-sm font-medium text-ink">
                  Year
                </label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYear(y)}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                        year === y
                          ? 'bg-ink text-canvas font-bold'
                          : 'bg-ink/8 text-ink hover:bg-ink/12'
                      }`}
                    >
                      {y} Year
                    </button>
                  ))}
                </div>
              </div>

              {/* Section */}
              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-ink">
                    Section
                  </label>
                  <span className="text-xs text-ink/60">(optional)</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {SECTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSection(section === s ? '' : s)}
                      className={`w-12 h-12 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                        section === s
                          ? 'bg-ink text-canvas font-bold'
                          : 'bg-ink/8 text-ink hover:bg-ink/12'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <Lock size={14} className="text-ink/60 mt-1 flex-shrink-0" />
                  <p className="text-xs text-ink/60">
                    Section is private — only you can see it
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <Button fullWidth size="lg" onClick={goNext} disabled={!canProceedStep2}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══════════ STEP 3: Privacy Walkthrough ═══════════ */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-2xl font-bold text-ink font-display">
                Your privacy, your way
              </h1>
              <p className="text-ink/60 mt-1 text-sm">
                Here's how we keep you safe on Quad.
              </p>

              {/* Swipeable privacy cards */}
              <div className="mt-8 flex-1 flex flex-col">
                <div className="relative flex-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={privacyCardIndex}
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -60 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -80 && privacyCardIndex < PRIVACY_CARDS.length - 1) {
                          setPrivacyCardIndex(privacyCardIndex + 1);
                        } else if (info.offset.x > 80 && privacyCardIndex > 0) {
                          setPrivacyCardIndex(privacyCardIndex - 1);
                        }
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {(() => {
                        const card = PRIVACY_CARDS[privacyCardIndex];
                        const IconComp = card.icon;
                        return (
                          <div className="bg-canvas rounded-3xl p-8 border border-ink/12">
                            <motion.div
                              className="w-20 h-20 bg-ink/6 border border-ink/12 rounded-2xl flex items-center justify-center mb-6 text-ink"
                              initial={{ scale: 0, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                            >
                              <IconComp size={40} className="text-ink" />
                            </motion.div>
                            <motion.h2
                              className="text-xl font-bold text-ink leading-tight font-display"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                            >
                              {card.title}
                            </motion.h2>
                            <motion.p
                              className="mt-3 text-ink/60 leading-relaxed"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                            >
                              {card.description}
                            </motion.p>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-2 mt-6">
                  {PRIVACY_CARDS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPrivacyCardIndex(i)}
                      className={`rounded-full transition-all duration-300 cursor-pointer ${
                        i === privacyCardIndex
                          ? 'w-8 h-2.5 bg-accent'
                          : 'w-2.5 h-2.5 bg-ink/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Nav arrows */}
                <div className="flex justify-between items-center mt-4 px-2">
                  <button
                    onClick={() => privacyCardIndex > 0 && setPrivacyCardIndex(privacyCardIndex - 1)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      privacyCardIndex > 0
                        ? 'text-ink hover:bg-ink/8'
                        : 'text-ink/30 cursor-default'
                    }`}
                    disabled={privacyCardIndex === 0}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <p className="text-xs text-ink/60">
                    Swipe or tap to navigate
                  </p>
                  <button
                    onClick={() =>
                      privacyCardIndex < PRIVACY_CARDS.length - 1 && setPrivacyCardIndex(privacyCardIndex + 1)
                    }
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      privacyCardIndex < PRIVACY_CARDS.length - 1
                        ? 'text-ink hover:bg-ink/8'
                        : 'text-ink/30 cursor-default'
                    }`}
                    disabled={privacyCardIndex === PRIVACY_CARDS.length - 1}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Get Started button — only on last card */}
                <div className="mt-6">
                  {privacyCardIndex === PRIVACY_CARDS.length - 1 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button fullWidth size="lg" onClick={goNext} icon={Sparkles}>
                        Get Started
                      </Button>
                      <p className="text-[10px] text-center text-ink/60 mt-3">
                        By continuing, you agree to Quad's Community Rules & Privacy Policy
                      </p>
                    </motion.div>
                  ) : (
                    <Button
                      fullWidth
                      size="lg"
                      variant="secondary"
                      onClick={() => setPrivacyCardIndex(privacyCardIndex + 1)}
                      icon={ChevronRight}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
