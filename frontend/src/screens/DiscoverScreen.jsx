import React, { useState, useMemo } from 'react';
import {
  Search,
  Compass,
  UserPlus,
  Check,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Card,
  Toggle,
  Button,
  Avatar,
  Input,
  EmptyState,
  ShieldBanner,
} from '../components/ui';

const BRANCHES = ['IT', 'DS', 'AI/ML', 'CSE', 'IoT', 'ME', 'CE', 'First Year'];
const YEARS = ['1st', '2nd', '3rd', '4th'];

export default function DiscoverScreen({ onNavigate: _onNavigate }) {
  const { state, toggleDiscoverability, requestFollow } = useApp();
  const optedIn = Boolean(state.discoverableByBranch);
  const [search, setSearch] = useState('');
  const [activeBranches, setActiveBranches] = useState([]);
  const [activeYears, setActiveYears] = useState([]);
  const [requestedIds, setRequestedIds] = useState(new Set());

  const discoverableUsers = useMemo(
    () => state.discoverableUsers || [],
    [state.discoverableUsers]
  );

  const toggleBranch = (b) =>
    setActiveBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );

  const toggleYear = (y) =>
    setActiveYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );

  const toggleRequestFollow = async (peer) => {
    await requestFollow(peer.username);
    setRequestedIds((prev) => {
      const next = new Set(prev);
      next.add(peer.id);
      return next;
    });
  };

  const handleOptIn = async () => {
    await toggleDiscoverability(!optedIn);
  };

  const filteredUsers = useMemo(() => {
    return discoverableUsers.filter((u) => {
      if (search && !u.username.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (activeBranches.length > 0 && !activeBranches.includes(u.branch))
        return false;
      if (activeYears.length > 0 && !activeYears.includes(u.year))
        return false;
      return true;
    });
  }, [discoverableUsers, search, activeBranches, activeYears]);

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-ink/12 gap-2">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Campus Peer Directory
          </h2>
          <p className="text-xs text-ink/60">
            Opt-in discovery only • Zero tracking or unsolicited exposure
          </p>
        </div>

        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full self-start sm:self-auto border ${
            optedIn
              ? 'bg-ink text-canvas border-ink'
              : 'bg-ink/6 text-ink/60 border-ink/12'
          }`}
        >
          {optedIn ? 'Discoverable (Active)' : 'Invisible (Default)'}
        </span>
      </div>

      {/* Opt-In Control Card */}
      <Card className="p-4 bg-canvas border border-ink/12">
        <Toggle
          active={optedIn}
          onToggle={handleOptIn}
          label="Let others in my branch find me"
          description={
            optedIn
              ? 'You are currently visible in the Department Directory. Turn off anytime to disappear.'
              : 'Discovery is strictly opt-in. While OFF, no student can search or browse your account.'
          }
          icon={optedIn ? Eye : EyeOff}
        />
      </Card>

      {/* When DISCOVERY IS OFF */}
      {!optedIn ? (
        <div className="space-y-4 pt-2">
          <ShieldBanner
            type="info"
            icon={EyeOff}
            message="Discovery is OFF by default to eliminate unsolicited stalking. Enable the toggle above whenever you want to connect with batchmates."
          />

          <EmptyState
            icon={Compass}
            title="Campus Discovery is Paused"
            description="To protect student privacy, Quad never indexes profiles automatically. Toggle 'Let others find me' whenever you want to network with batchmates."
            action={
              <Button variant="primary" size="md" onClick={handleOptIn} icon={Eye}>
                Opt In to Discovery
              </Button>
            }
          />
        </div>
      ) : (
        /* When DISCOVERY IS ON */
        <div className="space-y-4">
          <ShieldBanner
            type="info"
            icon={Lock}
            message="Privacy Enforced: Sections are NEVER displayed on student cards or search results. Only department and academic year are shown."
          />

          {/* Search Input */}
          <div className="max-w-md">
            <Input
              placeholder="Search students by pseudonym..."
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
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {BRANCHES.map((b) => {
                const active = activeBranches.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBranch(b)}
                    className={`px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      active
                        ? 'bg-ink text-canvas border-ink'
                        : 'bg-canvas text-ink/60 border-ink/12 hover:bg-ink/8 hover:text-ink'
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
            <div className="flex gap-2">
              {YEARS.map((y) => {
                const active = activeYears.includes(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => toggleYear(y)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      active
                        ? 'bg-ink text-canvas border-ink'
                        : 'bg-canvas text-ink/60 border-ink/12 hover:bg-ink/8 hover:text-ink'
                    }`}
                  >
                    {y} Year
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Directory Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Opted-in Students ({filteredUsers.length})
              </span>
              {(activeBranches.length > 0 || activeYears.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveBranches([]);
                    setActiveYears([]);
                  }}
                  className="text-xs text-accent font-semibold hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {filteredUsers.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No students match criteria"
                description="Try clearing department or year filters to view more opted-in peers."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map((user) => {
                  const isRequested = Boolean(user.isRequested) || requestedIds.has(user.id);
                  const isFollowing = Boolean(user.isFollowing);
                  return (
                    <Card
                      key={user.id}
                      className="p-4 bg-canvas border border-ink/12 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Avatar initials={user.initials || 'ST'} size="md" />
                          <div>
                            <p className="text-sm font-bold text-ink">
                              @{user.username}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                                {user.branch}
                              </span>
                              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                                {user.year} Year
                              </span>
                            </div>
                          </div>
                        </div>

                        {user.bio && (
                          <p className="text-xs text-ink/60 leading-relaxed line-clamp-2">
                            {user.bio}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isFollowing || isRequested}
                        onClick={() => toggleRequestFollow(user)}
                        className={`w-full min-h-[44px] py-2 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border disabled:cursor-default ${
                          isFollowing || isRequested
                            ? 'bg-ink/6 text-ink border-ink/12'
                            : 'bg-accent text-canvas border-transparent hover:opacity-90'
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
        </div>
      )}
    </div>
  );
}
