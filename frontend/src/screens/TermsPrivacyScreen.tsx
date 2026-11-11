import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Scale,
  UserCheck,
  Mail,
  Shield,
  MapPinOff,
  ArrowLeft,
} from 'lucide-react';
import { Card, Button } from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';

const SECTIONS = [
  { id: 'all', label: 'All Terms' },
  { id: 'rules', label: 'Community Rules' },
  { id: 'privacy', label: 'Data & Privacy' },
  { id: 'penalties', label: 'Penalties & Appeals' },
];

export default function TermsPrivacyScreen({
  onBack,
  onNavigate,
  embedded = false,
  onAgree,
}: {
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
  embedded?: boolean;
  onAgree?: () => void;
}) {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className={embedded ? 'w-full space-y-6' : 'w-full max-w-3xl mx-auto py-6 px-4 space-y-6'}>
      {!embedded && (
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-ink/12">
          <div>
            <h2 className="text-xl font-bold text-ink font-display">
              Terms & Conditions and Privacy Policy
            </h2>
            <p className="text-xs text-ink/60">
              Authoritative Campus Policy • Quad v2.6.0 • November 11, 2026
            </p>
          </div>
          {onBack && (
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={onBack}
            >
              Back
            </Button>
          )}
        </div>
      )}

      {/* Brand Overview Card */}
      <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
        <div className="flex items-center gap-4">
          <QuadLogo size={46} />
          <div>
            <h2 className="text-base font-bold text-ink font-display">
              Quad Terms & Privacy Architecture
            </h2>
            <p className="text-xs text-ink/60">
              Campus, on your terms • Official Policy for B.Tech Students
            </p>
          </div>
        </div>

        <p className="text-xs text-ink/60 leading-relaxed">
          By creating an account on Quad, you agree to these Terms and Privacy Policy. Quad is a safe, campus-only social platform engineered to prevent stalking, tracking, and unsolicited exposure.
        </p>

        <div className="pt-1 flex flex-wrap gap-2 text-xs font-semibold text-ink">
          <span className="px-3 py-1 rounded-full bg-ink/6 border border-ink/12 flex items-center gap-2">
            <Lock size={12} className="text-ink" />
            <span>Private by default</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-ink/6 border border-ink/12 flex items-center gap-2">
            <Mail size={12} className="text-ink" />
            <span>Email never shown</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-ink/6 border border-ink/12 flex items-center gap-2">
            <MapPinOff size={12} className="text-ink" />
            <span>Zero GPS tracking</span>
          </span>
        </div>
      </Card>

      {/* Filter Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {SECTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-ink text-canvas font-bold'
                : 'bg-canvas text-ink border border-ink/12 hover:bg-ink/8 font-medium'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──── SECTION 1: WELCOME & ACCEPTANCE ──── */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <ShieldCheck size={18} />
            <span>1. Welcome and Acceptance</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Quad is a campus-only social app for B.Tech engineering students. It lets you post publicly to campus, share a private personal space, and connect with people you choose.
          </p>
          <div className="p-4 rounded-xl bg-ink/6 border border-ink/12 space-y-2 text-xs text-ink">
            <p className="font-bold text-ink">In Short:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-ink/80">
              <li>Be yourself, be respectful, and don't make anyone feel unsafe.</li>
              <li>Your personal space is private unless you decide otherwise.</li>
              <li>We never show your college email to other users.</li>
              <li>Breaking the rules can lead to a warning, a suspension, or a permanent ban.</li>
              <li>If you do not agree with these Terms, please do not use the app.</li>
            </ul>
          </div>
        </Card>
      )}

      {/* ──── SECTION 2: ELIGIBILITY & ACCOUNTS ──── */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <UserCheck size={18} />
            <span>2. Eligibility and Accounts</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Only current enrolled students of the engineering college may use Quad, and each student may hold exactly one account.
          </p>
          <div className="space-y-3 text-xs text-ink/80">
            <div className="border-l-2 border-ink pl-3 space-y-1">
              <span className="font-bold text-ink">Verification:</span>
              <p className="text-xs text-ink/60">
                You sign up with the edu email issued by your college. We use it only to confirm you are a student. It is never displayed to other users.
              </p>
            </div>
            <div className="border-l-2 border-ink pl-3 space-y-1">
              <span className="font-bold text-ink">Username:</span>
              <p className="text-xs text-ink/60">
                Your public identity is a username, not your real name. Do not choose a username that copies, mocks, or impersonates another person.
              </p>
            </div>
            <div className="border-l-2 border-ink pl-3 space-y-1">
              <span className="font-bold text-ink">Your Details:</span>
              <p className="text-xs text-ink/60">
                Branch (IT, DS, AI/ML, CSE, IoT, ME, CE, or First Year) and year are optional profile details. You decide whether they are visible.
              </p>
            </div>
            <div className="border-l-2 border-ink pl-3 space-y-1">
              <span className="font-bold text-ink">One Person, One Account:</span>
              <p className="text-xs text-ink/60">
                Fake, duplicate, or shared accounts will be removed. When your college email stops working upon graduation, we may ask you to re-verify or deactivate the account.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ──── SECTION 3: SPACES & PRIVACY STRUCTURE ──── */}
      {(activeTab === 'all' || activeTab === 'privacy') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Lock size={18} />
            <span>3. Public Feed, Personal Space and Privacy</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Quad separates campus interaction into two distinct spaces. Your personal space is private by default:
          </p>

          <div className="overflow-hidden rounded-xl border border-ink/12 text-xs">
            <table className="w-full text-left">
              <thead className="bg-ink/6 text-ink font-bold border-b border-ink/12">
                <tr>
                  <th className="p-3">Space</th>
                  <th className="p-3">Who Can See It</th>
                  <th className="p-3">Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/12 text-xs">
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Public Feed</td>
                  <td className="p-3 text-ink/80">
                    Anyone on campus, shown under your pseudonym only
                  </td>
                  <td className="p-3 font-semibold text-ink">Public</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Personal Space</td>
                  <td className="p-3 text-ink/80">
                    Only people whose follow requests you approve
                  </td>
                  <td className="p-3 font-semibold text-accent">Private</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 text-xs text-ink/80 pt-1 leading-relaxed">
            <p>
              <strong className="text-ink">Follow Requests & Circles:</strong> People must send a request to see your Personal Space. You can place them in groups (Close Friends, My Branch, My Year, Classmates) and choose which group sees each post. You can remove a follower at any time—they are not notified.
            </p>
            <p>
              <strong className="text-ink">Branch, Year, and Section:</strong> We <strong className="text-ink">never display your section on your profile or posts</strong>. Branch and year are hidden unless you turn on discoverability (off by default).
            </p>
            <p>
              <strong className="text-ink">Making Your Profile Public:</strong> Before switching your Personal Space to public, the app shows an explicit warning screen explaining exactly what becomes visible.
            </p>
          </div>
        </Card>
      )}

      {/* ──── SECTION 4: COMMUNITY RULES ──── */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-danger font-bold text-sm">
            <AlertTriangle size={18} />
            <span>4. Community Rules (Zero Tolerance)</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Disagreeing is fine; hurting, scaring, or exposing people is strictly prohibited. You agree not to do any of the following on Quad:
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2 text-danger font-medium">
              <p><strong>Harass or bully anyone:</strong> repeated unwanted messages, mocking, or pile-ons.</p>
              <p><strong>Threaten violence or harm:</strong> even as a joke.</p>
              <p><strong>Dox or expose someone:</strong> sharing section, timetable, location, phone number, hostel/home details, or photos without consent.</p>
              <p><strong>Share private content elsewhere:</strong> taking screenshots of someone's Personal Space posts and sharing outside the app without permission.</p>
              <p><strong>Impersonate another person:</strong> or run fake or duplicate accounts.</p>
              <p><strong>Spread hate:</strong> against anyone based on religion, caste, gender, region, language, disability, branch, or year.</p>
              <p><strong>Share intimate content:</strong> any image of a person made or shared without their consent.</p>
              <p><strong>Stalk or track other users:</strong> including trying to work out who is behind a username to target them.</p>
              <p><strong>Break college rules:</strong> or use the app to cheat in exams or assessments.</p>
              <p><strong>Spam, scam, or misuse:</strong> automated bots, scraping, or overload attacks.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ──── SECTION 5: REPORTING, MODERATION & PENALTIES ──── */}
      {(activeTab === 'all' || activeTab === 'penalties') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Scale size={18} />
            <span>5. Reporting, Moderation and Penalties</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Anyone can report a post, comment, or account. Every report is reviewed by moderators.
          </p>

          <div className="overflow-hidden rounded-xl border border-ink/12 text-xs">
            <table className="w-full text-left">
              <thead className="bg-ink/6 text-ink font-bold border-b border-ink/12">
                <tr>
                  <th className="p-3 w-20">Step</th>
                  <th className="p-3">Disciplinary Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/12 text-xs">
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink/60">Step 1</td>
                  <td className="p-3 text-ink">Content removed and formal warning issued</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Step 2</td>
                  <td className="p-3 text-ink">Temporary account mute (24 hours)</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-danger">Step 3</td>
                  <td className="p-3 text-ink">Suspension (7 days)</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-danger">Step 4</td>
                  <td className="p-3 text-danger font-bold">Permanent campus ban</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-ink/6 border border-ink/12 text-xs text-ink space-y-2 leading-relaxed">
            <p className="font-bold">Identity & Accountability Notice:</p>
            <p className="text-xs text-ink/80">
              Your username hides your name from other students, but moderators and authorised administrators can identify the student behind an account if community rules are broken. Please do not treat Quad as an anonymous venue to escape accountability. Serious violations (threats, blackmail, sexual harassment) are escalated to college authorities and the police.
            </p>
          </div>

          <p className="text-xs text-ink/60">
            <strong className="text-ink">Appeals:</strong> If you believe a decision was made in error, you may appeal by emailing support within 7 days. An independent moderator will review the case.
          </p>
        </Card>
      )}

      {/* ──── SECTION 6: PRIVACY POLICY - WHAT WE COLLECT ──── */}
      {(activeTab === 'all' || activeTab === 'privacy') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <FileText size={18} />
            <span>6. Privacy Policy: What We Collect & Why</span>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            We collect only what is necessary to operate a safe campus app, and we never sell your data:
          </p>

          <div className="overflow-hidden rounded-xl border border-ink/12 text-xs">
            <table className="w-full text-left">
              <thead className="bg-ink/6 text-ink font-bold border-b border-ink/12">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Why</th>
                  <th className="p-3">Who Sees It</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/12 text-xs">
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">College edu email</td>
                  <td className="p-3 text-ink/60">Confirm student enrollment</td>
                  <td className="p-3 text-ink font-medium">Only you & auth admins. Never other users.</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Username</td>
                  <td className="p-3 text-ink/60">Sign in & campus identity</td>
                  <td className="p-3 text-ink">Visible to others.</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Branch & year</td>
                  <td className="p-3 text-ink/60">Opt-in discovery & group filtering</td>
                  <td className="p-3 text-ink">Hidden unless discoverability is toggled ON.</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Posts & media</td>
                  <td className="p-3 text-ink/60">Provide the social feed</td>
                  <td className="p-3 text-ink">Based strictly on audience chosen per-post.</td>
                </tr>
                <tr className="bg-canvas">
                  <td className="p-3 font-bold text-ink">Followers & blocks</td>
                  <td className="p-3 text-ink/60">Enforce privacy boundaries</td>
                  <td className="p-3 text-ink">Only you.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-ink/6 border border-ink/12 space-y-1 text-xs text-ink">
            <p className="font-bold text-ink">What We Do NOT Collect:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-ink/80">
              <li>We do not track your live location and do not show "active now" status.</li>
              <li>We automatically remove GPS and camera metadata (EXIF) from uploaded photos.</li>
              <li>We do not turn on message read receipts by default.</li>
              <li>We do not access your contacts, gallery, or microphone without permission.</li>
              <li><strong className="text-ink">Section:</strong> If provided, it is used only by you to filter your private groups. It is never displayed on your profile or posts.</li>
            </ul>
          </div>
        </Card>
      )}

      {/* ──── SECTION 7: SHARING, STORAGE & RIGHTS ──── */}
      {(activeTab === 'all' || activeTab === 'privacy') && (
        <Card className="p-6 bg-canvas border border-ink/12 space-y-3">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Scale size={18} />
            <span>7. Sharing, Storage and Student Rights</span>
          </div>
          <div className="space-y-3 text-xs text-ink/80 leading-relaxed">
            <p>
              <strong className="text-ink">When we share info:</strong> Only with college authorities for serious safety violations or legal warrants; with essential hosting/email providers under confidentiality; never sold to advertisers or data brokers.
            </p>
            <p>
              <strong className="text-ink">Data Retention:</strong> Posts are kept until you delete them. Deleted accounts are purged within 30 days (moderation audit logs retained up to 12 months to prevent repeat abuse).
            </p>
            <p>
              <strong className="text-ink">Your Rights:</strong> See & edit profile, download copy of data, delete individual posts or whole account anytime, withdraw consent for optional features.
            </p>
            <p>
              <strong className="text-ink">Screenshots & Trust:</strong> We cannot physically prevent third-party device screenshots of your personal space. Only approve follow requests from peers you genuinely trust.
            </p>
          </div>
        </Card>
      )}

      {/* ──── SECTION 8: LEGAL, GOVERNING LAW & CONTACT ──── */}
      <Card className="p-6 bg-canvas border border-ink/12 space-y-3 text-xs text-ink/80">
        <div className="flex items-center gap-2 text-ink font-bold text-sm">
          <Shield size={18} />
          <span>8. Disclaimers, Governing Law & Contact</span>
        </div>
        <p>
          <strong className="text-ink">Ownership:</strong> You retain ownership of all content you author.
        </p>
        <p>
          <strong className="text-ink">Governing Law:</strong> Governed by the laws of India. Disputes subject to local jurisdiction.
        </p>
        <div className="p-3 rounded-xl bg-ink/6 border border-ink/12 space-y-1 text-xs text-ink">
          <p><strong className="text-ink">Support & Appeals:</strong> support@quadcampus.app</p>
          <p><strong className="text-ink">Grievance Officer:</strong> grievance@quadcampus.app</p>
          <p><strong className="text-ink">Campus Emergency:</strong> 1800-CAMPUS-SAFE</p>
        </div>
      </Card>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onAgree || onBack || (() => onNavigate?.('settings'))}
      >
        I Understand & Agree
      </Button>
    </div>
  );
}
