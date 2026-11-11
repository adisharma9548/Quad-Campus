import React, { useState } from 'react';
import {
  MessageSquare,
  Heart,
  Share2,
  Send,
  ShieldCheck,
  MoreHorizontal,
  MessagesSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Avatar, PrivacyBadge, Card, Button, EmptyState } from '../components/ui';

export default function ThreadsScreen({ onNavigate: _onNavigate }) {
  const { state, createThread, toggleThreadLike, addThreadReply } = useApp();
  const { showToast } = useToast();
  const threadPosts = state.threadPosts || [];
  const [newThreadText, setNewThreadText] = useState('');
  const [activeReplyPostId, setActiveReplyPostId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const toggleLike = async (id) => {
    await toggleThreadLike(id);
  };

  const handlePostThread = async (e) => {
    e.preventDefault();
    if (!newThreadText.trim()) return;
    try {
      await createThread(newThreadText.trim());
      setNewThreadText('');
      showToast('Discussion posted to campus thread', 'success');
    } catch (err) {
      showToast(err?.message || 'Unable to post discussion', 'error');
    }
  };

  const handleAddReply = async (postId) => {
    if (!replyText.trim()) return;
    try {
      await addThreadReply(postId, replyText.trim());
      setReplyText('');
      setActiveReplyPostId(null);
      showToast('Reply added cleanly', 'success');
    } catch (err) {
      showToast(err?.message || 'Unable to post reply', 'error');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Thread Composer Card */}
      <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px]">
        <form onSubmit={handlePostThread} className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar initials={state.userInitials || 'QD'} size="md" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-ink truncate">
                  @{state.username || 'quantum_dev'}
                </span>
                <PrivacyBadge level="public" labelCustom="Campus Thread" size="sm" />
              </div>
              <textarea
                rows={2}
                value={newThreadText}
                onChange={(e) => setNewThreadText(e.target.value)}
                placeholder="Start a campus discussion or direct peer inquiry..."
                aria-label="New thread message"
                className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px] p-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-ink/12 gap-3 flex-wrap">
            <span className="text-xs text-ink/60">
              Plain text discussions • No real names exposed
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newThreadText.trim()}
              icon={Send}
            >
              Post Thread
            </Button>
          </div>
        </form>
      </Card>

      {/* Threads List */}
      {threadPosts.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No Discussions Active"
          description="Campus Q&A, study notes, and peer-to-peer technical threads will appear here."
        />
      ) : (
        <div className="space-y-4">
          {threadPosts.map((post) => {
            const isLiked = Boolean(post.isLiked);
            return (
              <Card
                key={post.id}
                className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px] space-y-4 hover:border-ink/24 transition-colors"
              >
                {/* Parent Post Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar initials={post.initials} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink truncate">
                          @{post.username}
                        </span>
                        <ShieldCheck size={16} className="text-ink shrink-0" aria-label="Verified student" />
                        <span className="text-xs text-ink/60">• {post.timestamp}</span>
                      </div>
                      <span className="text-xs text-accent font-semibold">
                        Verified Peer
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Thread options for @${post.username}`}
                    onClick={() => showToast('Thread reporting & mute options via Feed', 'info')}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] text-ink/60 hover:text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {/* Thread Content */}
                <p className="text-sm text-ink leading-relaxed pl-0 sm:pl-12 font-normal break-words">
                  {post.content}
                </p>

                {/* Action Bar */}
                <div className="flex items-center gap-2 sm:gap-4 pl-0 sm:pl-12 pt-1 text-xs text-ink/60 flex-wrap">
                  {/* Like Heart: NOT red per spec -> filled Ink heart */}
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    aria-label={isLiked ? 'Unlike thread' : 'Like thread'}
                    className={`min-h-[44px] px-3 py-2 rounded-[8px] flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isLiked ? 'text-ink font-bold bg-ink/6' : 'hover:text-ink hover:bg-ink/4'
                    }`}
                  >
                    <Heart size={16} className={isLiked ? 'fill-ink text-ink' : 'text-ink/60'} />
                    <span>{post.likes || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveReplyPostId(
                        activeReplyPostId === post.id ? null : post.id
                      )
                    }
                    aria-label={`Reply to @${post.username}`}
                    className="min-h-[44px] px-3 py-2 rounded-[8px] flex items-center gap-2 hover:text-ink hover:bg-ink/4 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <MessageSquare size={16} />
                    <span>{post.replyCount || (post.replies?.length || 0)} replies</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Share thread link"
                    onClick={() => showToast('Thread link copied to clipboard', 'success')}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] flex items-center justify-center hover:text-ink hover:bg-ink/4 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Share2 size={16} />
                  </button>
                </div>

                {/* Replies Thread Section */}
                {post.replies && post.replies.length > 0 && (
                  <div className="pl-4 sm:pl-12 pt-3 space-y-3 relative">
                    {/* Subtle vertical connector thread line */}
                    <div className="absolute left-2 sm:left-6 top-0 bottom-4 w-0.5 bg-ink/12" />

                    {post.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="relative flex items-start gap-3 bg-ink/6 p-3 rounded-[8px] border border-ink/12"
                      >
                        <Avatar initials={reply.initials} size="sm" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-ink truncate">
                              @{reply.username}
                            </span>
                            <span className="text-xs text-ink/60">
                              • {reply.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-ink leading-relaxed break-words">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Reply Input if activated */}
                {activeReplyPostId === post.id && (
                  <div className="pl-0 sm:pl-12 pt-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddReply(post.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to @${post.username}...`}
                        aria-label={`Reply input for @${post.username}`}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-[8px] text-xs bg-canvas border border-ink/12 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={!replyText.trim()}
                      >
                        Reply
                      </Button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
