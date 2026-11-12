import React, { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Check,
  EyeOff,
  Eye,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useInstitution } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import { PeerProfileModal } from '../components/PeerProfileModal';
import {
  Avatar,
  Card,
  Toggle,
  Button,
  Input,
  EmptyState,
  ShieldBanner,
} from '../components/ui';
import type { PeerUser } from '../types/quad';

function normalizeShortYear(year: string | null | undefined): string {
  return String(year || '')
    .replace(/\s*Year$/i, '')
    .trim();
}

function programToBranchCode(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('information technology')) return 'IT';
  if (lower.includes('data science')) return 'DS';
  if (lower.includes('artificial intelligence')) return 'AI/ML';
  if (lower.includes('internet of things')) return 'IoT';
  if (lower.includes('computer science')) return 'CSE';
  if (lower.includes('civil')) return 'CE';
  if (lower.includes('mechanical')) return 'ME';
  if (lower.includes('electrical & electronics')) return 'EE';
  if (lower.includes('electronics & communication')) return 'ECE';
  return name.trim();
}

export default function DiscoverScreen({
  onNavigate: _onNavigate,
}: {
  onNavigate?: (screen: string) => void;
}) {
  const { state, toggleDiscoverability, requestFollow } = useApp();
  const institution = useInstitution();
  const { showToast } = useToast();

  const optedIn = Boolean(state.discoverableByBranch);
  const [search, setSearch] = useState('');
  const [activeBranches, setActiveBranches] = useState<string[]>([]);
  const [activeYears, setActiveYears] = useState<string[]>([]);
  const [requestedUsernames, setRequestedUsernames] = useState<Set<string>>(() => new Set());
  const [selectedPeer, setSelectedPeer] = useState<PeerUser | null>(null);

  const branches = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of institution.programs || []) {
      const code = programToBranchCode(p);
      if (code && !seen.has(code)) {
        seen.add(code);
        list.push(code);
      }
    }
    for (const u of state.discoverableUsers || []) {
      if (u.branch && !seen.has(u.branch)) {
        seen.add(u.branch);
        list.push(u.branch);
      }
    }
    return list;
  }, [institution.programs, state.discoverableUsers]);

  const years = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const y of institution.years || ['1st Year', '2nd Year', '3rd Year', '4th Year']) {
      const short = normalizeShortYear(y);
      if (short && !seen.has(short)) {
        seen.add(short);
        list.push(short);
      }
    }
    return list;
  }, [institution.years]);

  // Single source of truth mirror: strictly opted-in, deduplicated peers excluding self & blocks.
  // Directory keeps showing connected peers with their Following / Requested state;
  // Who to follow excludes already-followed and pending-request peers.
  // Importantly: Viewer's own Directory OFF setting NEVER blocks browsing others.
  const discoverableUsers = useMemo(() => {
    const raw = state.discoverableUsers || [];
    const seen = new Set<string>();
    const blockedSet = new Set((state.blockedUsers || []).map((b) => b.username.toLowerCase()));
    const followingSet = new Set((state.following || []).map((f) => f.username.toLowerCase()));
    const selfHandle = (state.username || '').toLowerCase();

    return raw
      .filter((u) => {
        const handle = (u.username || '').toLowerCase();
        if (!handle || seen.has(handle)) return false;
        seen.add(handle);
        if (selfHandle && handle === selfHandle) return false;
        if (u.directoryVisible === false || u.discoverable === false) return false;
        if (blockedSet.has(handle)) return false;
        return true;
      })
      .map((u) => {
        const handle = (u.username || '').toLowerCase();
        return {
          ...u,
          isFollowing: Boolean(u.isFollowing) || followingSet.has(handle),
          isRequested: Boolean(u.isRequested) || requestedUsernames.has(handle),
        };
      });
  }, [
    state.discoverableUsers,
    state.blockedUsers,
    state.following,
    state.username,
    requestedUsernames,
  ]);

  const toggleBranch = (b: string) =>
    setActiveBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );

  const toggleYear = (y: string) =>
    setActiveYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );

  const handleRequestFollow = async (
    e: React.MouseEvent,
    peer: PeerUser
  ) => {
    e.stopPropagation();
    const handle = peer.username.toLowerCase();
    setRequestedUsernames((prev) => {
      const next = new Set(prev);
      next.add(handle);
      return next;
    });
    try {
      const res = await requestFollow(peer.username);
      showToast(
        res.status === 'following'
          ? `Now following @${peer.username}`
          : `Follow request sent to @${peer.username}`,
        'success'
      );
    } catch (err) {
      setRequestedUsernames((prev) => {
        const next = new Set(prev);
        next.delete(handle);
        return next;
      });
      showToast(err instanceof Error ? err.message : 'Unable to send follow request', 'error');
    }
  };

  const handleOptIn = async () => {
    const next = !optedIn;
    await toggleDiscoverability(next);
    showToast(
      next
        ? 'You are now visible in Directory and Who to follow'
        : "People won't find you in Directory or Who to follow. You can still browse others.",
      'info'
    );
  };

  const hasActiveFilters = Boolean(search.trim()) || activeBranches.length > 0 || activeYears.length > 0;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return discoverableUsers.filter((u) => {
      const branch = (u.branch || '').toLowerCase();
      const year = normalizeShortYear(u.year).toLowerCase();
      if (q) {
        const haystack = `${u.username} ${u.bio || ''} ${u.branch || ''} ${year} ${(u.interests || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (
        activeBranches.length > 0 &&
        !activeBranches.some((b) => b.toLowerCase() === branch)
      ) {
        return false;
      }
      if (
        activeYears.length > 0 &&
        !activeYears.some((y) => normalizeShortYear(y).toLowerCase() === year)
      ) {
        return false;
      }
      return true;
    });
  }, [discoverableUsers, search, activeBranches, activeYears]);

  const clearFilters = () => {
    setSearch('');
    setActiveBranches([]);
    setActiveYears([]);
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-ink/12 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Campus Directory
          </h2>
          <p className="text-xs text-ink/60 mt-1">
            Browse students who opted in to campus discovery
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            optedIn
              ? 'bg-accent/12 text-accent border-accent/25'
              : 'bg-ink/6 text-ink/60 border-ink/12'
          }`}
        >
          {optedIn ? 'Discoverable (ON)' : 'Hidden (OFF)'}
        </span>
      </div>

      {/* Opt-In Control Card (Viewer can always browse others even when OFF) */}
      <Card className="p-4 bg-canvas border border-ink/12 space-y-2">
        <Toggle
          active={optedIn}
          onToggle={handleOptIn}
          label="Let others find me in Directory & Who to follow"
          description={
            optedIn
              ? 'You are visible in Directory and Who to follow. Turn OFF anytime to disappear.'
              : "People won't find you in Directory or Who to follow. You can still browse others."
          }
          icon={optedIn ? Eye : EyeOff}
        />
      </Card>

      <ShieldBanner
        type="info"
        icon={ShieldCheck}
        message="Privacy Enforced: Sections and college emails are NEVER shown. Only pseudonyms, branch, and academic year appear for opted-in students."
      />

      {/* Search & Filters (always available even if current user is hidden) */}
      <div className="space-y-4">
        <div className="max-w-md">
          <Input
            placeholder="Search students by username, bio, or interests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />
        </div>

        {/* Department / Branch Filters */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink/60 px-1">
            Filter by Department
          </label>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => {
              const active = activeBranches.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBranch(b)}
                  className={`min-h-[44px] px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                    active
                      ? 'bg-ink text-canvas border-ink'
                      : 'bg-ink/6 text-ink border-ink/12 hover:bg-ink/12'
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        {/* Academic Year Filters */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink/60 px-1">
            Filter by Academic Year
          </label>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => {
              const active = activeYears.includes(y);
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(y)}
                  className={`min-h-[44px] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                    active
                      ? 'bg-ink text-canvas border-ink'
                      : 'bg-ink/6 text-ink border-ink/12 hover:bg-ink/12'
                  }`}
                >
                  <GraduationCap size={14} aria-hidden="true" />
                  <span>{y} Year</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header & Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Opted-in Students ({filteredUsers.length}
            {hasActiveFilters && discoverableUsers.length !== filteredUsers.length
              ? ` of ${discoverableUsers.length}`
              : ''}
            )
          </h3>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-accent font-semibold hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title={
              hasActiveFilters
                ? 'No students match criteria'
                : 'No discoverable students available'
            }
            description={
              hasActiveFilters
                ? 'Try clearing your search or branch and year filters to view more opted-in peers.'
                : 'No verified students currently have Directory visibility turned on.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredUsers.map((peer) => {
              const isRequested =
                Boolean(peer.isRequested) ||
                requestedUsernames.has(peer.username.toLowerCase());
              const isFollowing = Boolean(peer.isFollowing);
              const yearShort = normalizeShortYear(peer.year);
              return (
                <Card
                  key={peer.id}
                  onClick={() => setSelectedPeer(peer)}
                  className="p-4 bg-canvas border border-ink/12 hover:border-ink/30 transition-colors flex flex-col justify-between space-y-3 cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        initials={peer.initials || 'ST'}
                        username={peer.username}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink truncate">
                          @{peer.username}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {peer.branch && (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                              {peer.branch}
                            </span>
                          )}
                          {yearShort && (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                              {yearShort} Year
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {peer.bio && (
                      <p className="text-xs text-ink/60 leading-relaxed line-clamp-2">
                        {peer.bio}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isFollowing || isRequested}
                    onClick={(e) => handleRequestFollow(e, peer)}
                    className={`w-full min-h-[44px] py-2 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border disabled:cursor-default ${
                      isFollowing || isRequested
                        ? 'bg-ink/6 text-ink border-ink/12'
                        : 'bg-accent text-canvas border-transparent hover:brightness-90'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Following</span>
                      </>
                    ) : isRequested ? (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Request Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} strokeWidth={2} />
                        <span>Request Follow</span>
                      </>
                    )}
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PeerProfileModal
        username={selectedPeer?.username || null}
        fallbackPeer={selectedPeer}
        onClose={() => setSelectedPeer(null)}
      />
    </div>
  );
}
