import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Globe,
  Users,
  Moon,
  Sun,
  Sliders,
  Type,
  Palette,
  AlertTriangle,
  Clock,
  Sparkles,
  Inbox,
  Maximize2,
} from 'lucide-react';
import {
  PrivacyBadge,
  Card,
  Button,
  TextField,
  Avatar,
  Modal,
  Sheet,
  Skeleton,
  EmptyState,
  Spinner,
  Header,
} from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { TOKENS, SPACING } from '../theme';

export default function DesignSystemScreen({ onBack }: { onBack?: () => void }) {
  const { dark, toggle } = useTheme();
  const { toast } = useToast();

  const [sampleText, setSampleText] = useState('Campus student');
  const [sampleError, setSampleError] = useState('Please enter a valid handle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const lightTokens = [
    { role: 'Canvas (~62%)', token: 'canvas', hex: TOKENS.light.canvas, desc: 'All backgrounds, sheets, modals, nav bars' },
    { role: 'Ink (~28%)', token: 'ink', hex: TOKENS.light.ink, desc: 'All text, icons, borders, active tab, secondary buttons' },
    { role: 'Accent Blue (~8%)', token: 'accent', hex: TOKENS.light.accent, desc: 'Primary buttons, links, @mentions, focus rings' },
    { role: 'Danger Red (~2%)', token: 'danger', hex: TOKENS.light.danger, desc: 'Destructive confirmations, reports, blocks' },
  ];

  const darkTokens = [
    { role: 'Canvas (~62%)', token: 'canvas', hex: TOKENS.dark.canvas, desc: 'Dark background surfaces' },
    { role: 'Ink (~28%)', token: 'ink', hex: TOKENS.dark.ink, desc: 'High contrast text, icons, borders' },
    { role: 'Accent Blue (~8%)', token: 'accent', hex: TOKENS.dark.accent, desc: 'Primary buttons, selected states, links' },
    { role: 'Danger Red (~2%)', token: 'danger', hex: TOKENS.dark.danger, desc: 'Block, delete, error states' },
  ];

  const derivedStates = [
    { name: 'Secondary Text / Captions', opacity: '60%', cls: 'text-ink/60' },
    { name: 'Dividers / Borders', opacity: '12%', cls: 'border-ink/12' },
    { name: 'Card / Elevated Fills', opacity: '6%', cls: 'bg-ink/6' },
    { name: 'Pressed / Hover', opacity: '8%', cls: 'hover:bg-ink/8' },
    { name: 'Inactive Tab / Icon', opacity: '55%', cls: 'text-ink/55' },
    { name: 'Disabled State', opacity: '30%', cls: 'opacity-30' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink pb-12">
      <Header
        title="Design System Foundation"
        subtitle="Quad Design Tokens & Reusable Component Library"
        onBack={onBack}
        rightAction={toggle}
        rightIcon={dark ? Sun : Moon}
      />

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        {/* Brand identity banner */}
        <Card className="bg-canvas border border-ink/12">
          <div className="flex items-center gap-4">
            <QuadLogo size={56} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink font-display">
                Quad Design System
              </h2>
              <p className="text-xs text-ink/60 mt-1 font-medium">
                "Campus, on your terms" • Strict 4-Color & Design Token Foundation
              </p>
            </div>
          </div>
        </Card>

        {/* 1. Core Color System */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Palette size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              1. Core Color System (4 Colors Only)
            </h3>
          </div>
          <Card className="p-4 space-y-4 bg-canvas border border-ink/12">
            <div>
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Light Mode Tokens
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {lightTokens.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-[8px] border border-ink/12 bg-canvas flex flex-col justify-between"
                  >
                    <div
                      className="w-full h-10 rounded-[8px] mb-2 border border-ink/12"
                      style={{ backgroundColor: item.hex }}
                    />
                    <p className="text-xs font-bold text-ink truncate">
                      {item.role}
                    </p>
                    <p className="text-xs font-mono text-ink/60">
                      {item.hex}
                    </p>
                    <p className="text-xs text-ink/60 mt-1 leading-tight">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Dark Mode Tokens
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {darkTokens.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-[8px] border border-ink/12 bg-canvas flex flex-col justify-between"
                  >
                    <div
                      className="w-full h-10 rounded-[8px] mb-2 border border-ink/12"
                      style={{ backgroundColor: item.hex }}
                    />
                    <p className="text-xs font-bold text-ink truncate">
                      {item.role}
                    </p>
                    <p className="text-xs font-mono text-ink/60">
                      {item.hex}
                    </p>
                    <p className="text-xs text-ink/60 mt-1 leading-tight">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Derived States (Tints Only)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {derivedStates.map((st, i) => (
                  <div key={i} className="p-3 rounded-[8px] bg-ink/6 border border-ink/12">
                    <p className="text-xs font-semibold text-ink">{st.name}</p>
                    <p className="text-xs text-ink/60 font-mono mt-1">{st.cls} ({st.opacity})</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* 2. Spacing Scale */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Sliders size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              2. Strict Spacing Scale (4, 8, 12, 16, 24, 32, 48 px)
            </h3>
          </div>
          <Card className="p-4 space-y-2 bg-canvas border border-ink/12">
            <p className="text-xs text-ink/60 mb-2">
              All margins, paddings, and gaps in the design system strictly map to 7 tokens:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SPACING).map(([key, px]) => (
                <div key={key} className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-ink">space-{key}</p>
                    <p className="text-xs font-mono text-ink/60">{px}px</p>
                  </div>
                  <div
                    className="bg-accent rounded-[4px]"
                    style={{ width: `${Math.min(px, 32)}px`, height: '16px' }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 3. Typography & Radius Tokens */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Type size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              3. Typography (5 Sizes, 3 Weights) & 2 Radii
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div className="space-y-3">
              <div className="border-b border-ink/12 pb-2">
                <span className="text-xs font-mono text-ink/60">Display (24px / Bold 700)</span>
                <h1 className="text-2xl font-bold tracking-tight text-ink font-display mt-1">
                  Campus, on your terms.
                </h1>
              </div>
              <div className="border-b border-ink/12 pb-2">
                <span className="text-xs font-mono text-ink/60">Title (18px / Bold 700)</span>
                <h2 className="text-lg font-bold text-ink font-display mt-1">
                  Personal Space • @quantum_dev
                </h2>
              </div>
              <div className="border-b border-ink/12 pb-2">
                <span className="text-xs font-mono text-ink/60">Body (16px / Regular 400)</span>
                <p className="text-base text-ink leading-relaxed mt-1">
                  By default, your profile is private and never indexed without your consent.
                </p>
              </div>
              <div className="border-b border-ink/12 pb-2">
                <span className="text-xs font-mono text-ink/60">Body Small (14px / Medium 500)</span>
                <p className="text-sm font-medium text-ink/80 mt-1">
                  Verified campus community for B.Tech engineering students.
                </p>
              </div>
              <div>
                <span className="text-xs font-mono text-ink/60">Caption (12px / Regular 400)</span>
                <p className="text-xs text-ink/60 mt-1">
                  Only people you approve can see your posts and profile.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12 grid grid-cols-3 gap-2">
              <div className="p-3 bg-ink/6 border border-ink/12 rounded-[8px] text-center">
                <p className="text-xs font-bold text-ink">radius-sm</p>
                <p className="text-xs text-ink/60">8px (controls, buttons, inputs)</p>
              </div>
              <div className="p-3 bg-ink/6 border border-ink/12 rounded-[16px] text-center">
                <p className="text-xs font-bold text-ink">radius-md</p>
                <p className="text-xs text-ink/60">16px (cards, sheets, modals)</p>
              </div>
              <div className="p-3 bg-ink/6 border border-ink/12 rounded-full text-center">
                <p className="text-xs font-bold text-ink">radius-full</p>
                <p className="text-xs text-ink/60">9999px (avatars, pills)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* 4. Button Component (All States) */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Sliders size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              4. Button Component (All States & Min 44px Tap Target)
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div>
              <p className="text-xs text-ink/60 mb-2">Variants (Primary, Secondary, Destructive, Outline):</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="destructive">Destructive / Block</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-ink/60 mb-2">States (Disabled, Loading, Icon):</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled>
                  Disabled State
                </Button>
                <Button variant="primary" loading={isLoadingDemo} onClick={() => setIsLoadingDemo(!isLoadingDemo)}>
                  {isLoadingDemo ? 'Loading...' : 'Click to Load'}
                </Button>
                <Button variant="secondary" icon={Sparkles}>
                  With Icon
                </Button>
                <Button variant="destructive" icon={AlertTriangle}>
                  Confirm Report
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* 5. TextField Component (All States) */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Type size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              5. TextField Component (All States)
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="Default Input"
                placeholder="Enter handle..."
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                helper="Minimum 3 characters"
              />
              <TextField
                label="Input with Icon"
                icon={Users}
                placeholder="Search classmate..."
              />
              <TextField
                label="Error State"
                value="invalid_@"
                error={sampleError}
                onChange={() => setSampleError('')}
              />
              <TextField
                label="Disabled State"
                value="cannot_edit_handle"
                disabled
                helper="Locked by administrator"
              />
            </div>
          </Card>
        </div>

        {/* 6. Avatar & Badges */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Shield size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              6. Avatar (Sizes 32, 44, 48 px) & Privacy Badges
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar initials="SM" size="sm" />
                <span className="text-xs text-ink/60">32px (sm)</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar initials="QD" size="md" showBadge badgeType="private" />
                <span className="text-xs text-ink/60">44px (md - touch min)</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar initials="LG" size="lg" showBadge badgeType="group" />
                <span className="text-xs text-ink/60">48px (lg)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12 flex flex-wrap gap-2">
              <PrivacyBadge level="private" />
              <PrivacyBadge level="public" />
              <PrivacyBadge level="group" labelCustom="Close Friends" />
              <PrivacyBadge level="followers" />
            </div>
          </Card>
        </div>

        {/* 7. Modal, Sheet & Toast Controls */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Maximize2 size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              7. Overlays: Modal, Sheet & Toast Notifications
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div>
              <p className="text-xs text-ink/60 mb-2">Dialog Triggers:</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                  Open Modal Dialog
                </Button>
                <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
                  Open Bottom Sheet
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12">
              <p className="text-xs text-ink/60 mb-2">Trigger Live Toasts:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Privacy status synced with campus vault.', 'Information')}
                >
                  Show Info Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success('Follower request accepted silently.', 'Success')}
                >
                  Show Success Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.danger('Account toxic_troll was blocked.', 'Blocked')}
                >
                  Show Danger Toast
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* 8. Skeletons & Spinners */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Clock size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              8. Skeleton Loaders & Spinners (16, 20, 24 px)
            </h3>
          </div>
          <Card className="space-y-4 bg-canvas border border-ink/12">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-xs text-ink/60">16px</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner size="md" />
                <span className="text-xs text-ink/60">20px</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner size="lg" />
                <span className="text-xs text-ink/60">24px</span>
              </div>
            </div>

            <div className="pt-2 border-t border-ink/12 space-y-2">
              <p className="text-xs text-ink/60">Content Skeleton:</p>
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" width="44px" height="44px" />
                <div className="space-y-2 flex-1">
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 9. Empty State */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Inbox size={16} className="text-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              9. Empty State Pattern
            </h3>
          </div>
          <Card className="bg-canvas border border-ink/12">
            <EmptyState
              icon={Inbox}
              title="No Pending Follow Requests"
              description="When peers request to see your Personal Space, they will appear here for group categorization."
              action={
                <Button variant="secondary" size="sm">
                  Refresh Requests
                </Button>
              }
            />
          </Card>
        </div>
      </div>

      {/* Demo Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Privacy Confirmation"
        description="This action updates your campus visibility setting."
      >
        <p className="text-xs text-ink/80 leading-relaxed mb-4">
          All posts in your Personal Space remain restricted strictly to students who have been accepted into your follower circles.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setIsModalOpen(false)}>
            Confirm Settings
          </Button>
        </div>
      </Modal>

      {/* Demo Sheet */}
      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Campus Audience Selector"
        description="Choose which students can view this publication."
      >
        <div className="space-y-2 mb-4">
          <button className="flex items-center justify-between w-full p-3 rounded-[8px] border border-ink/12 hover:bg-ink/8 transition-colors text-left cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-ink">Public Campus Feed</p>
              <p className="text-xs text-ink/60">Visible to all students under pseudonym</p>
            </div>
            <Globe size={18} className="text-ink" />
          </button>
          <button className="flex items-center justify-between w-full p-3 rounded-[8px] border border-ink/12 hover:bg-ink/8 transition-colors text-left cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-ink">My Branch Only</p>
              <p className="text-xs text-ink/60">CSE department students</p>
            </div>
            <Lock size={18} className="text-ink" />
          </button>
        </div>
        <Button variant="primary" fullWidth onClick={() => setIsSheetOpen(false)}>
          Done
        </Button>
      </Sheet>
    </div>
  );
}
