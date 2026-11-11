import React, { useRef, useState } from 'react';
import {
  X,
  Globe,
  Users,
  GraduationCap,
  Calendar,
  Lock,
  Image as ImageIcon,
  MapPinOff,
  Check,
  Send,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { Button, ShieldBanner, Badge, Modal, Card } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { resolveApiMediaUrl } from '../services/apiClient';

const MAX_CHARS = 500;

const POST_TYPES = ['Discussion', 'Question', 'Tip', 'Resource', 'Event', 'Update'];

const AUDIENCES = [
  {
    id: 'public',
    label: 'Public (Campus)',
    icon: Globe,
    desc: 'Any verified student on campus can view with your pseudonym only.',
  },
  {
    id: 'followers',
    label: 'Approved Followers',
    icon: Users,
    desc: 'Only students whose follow requests you have approved in Personal Space.',
  },
  {
    id: 'friends',
    label: 'Close Friends Circle',
    icon: Lock,
    desc: 'Restricted to followers tagged in your private Close Friends group.',
  },
  {
    id: 'branch',
    label: 'My Branch',
    icon: GraduationCap,
    desc: 'Visible only to verified peers in your department.',
  },
  {
    id: 'year',
    label: 'My Year',
    icon: Calendar,
    desc: 'Visible only to verified students in your academic batch.',
  },
];

export function CreatePostForm({ onComplete, onCancel }) {
  const { state, createPost, uploadMediaImage } = useApp();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [postType, setPostType] = useState('Discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('public');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [locationTag, setLocationTag] = useState('Library Hall, East Wing');
  const [imageAlt, setImageAlt] = useState('');

  const charsLeft = MAX_CHARS - content.length;
  const overLimit = charsLeft < 0;
  const isEmpty = content.trim().length === 0;

  const selectedAudience =
    AUDIENCES.find((a) => a.id === audience) || AUDIENCES[0];

  const extractHashtags = (text) => {
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? Array.from(new Set(matches)).slice(0, 4) : ['#Campus'];
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadMediaImage(file);
      setUploadedMedia({
        mediaId: res.mediaId,
        url: res.url,
        fileName: file.name,
        strippedBytes: res.strippedBytes || 0,
      });
      setHasPhoto(true);
      showToast(
        res.strippedBytes > 0
          ? `Photo attached — stripped ${res.strippedBytes} bytes of EXIF/GPS metadata`
          : 'Photo attached & EXIF verified clean',
        'success'
      );
    } catch (err) {
      showToast(err?.message || 'Could not process image upload', 'error');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handlePost = async () => {
    if (isEmpty || overLimit || isPublishing || isUploading) return;
    setIsPublishing(true);
    try {
      const cleanBody = content.trim();
      const derivedTitle =
        title.trim() ||
        cleanBody.split(/[.!?\n]/)[0].slice(0, 80);

      const isPersonal = audience === 'followers' || audience === 'friends';
      await createPost({
        type: postType,
        title: derivedTitle,
        content: cleanBody,
        hashtags: extractHashtags(cleanBody),
        space: isPersonal ? 'personal' : 'public',
        audience: audience === 'friends' ? 'group' : selectedAudience.id,
        groupName: audience === 'friends' ? 'Close Friends' : '',
        hasImage: hasPhoto,
        mediaId: uploadedMedia?.mediaId || null,
        mediaUrl: uploadedMedia?.url || '',
        mediaKey: 'library',
        location: hasPhoto ? locationTag.trim() || 'Campus Space' : '',
        imageAlt: hasPhoto
          ? imageAlt.trim() || `Photo attachment posted by @${state.username || 'quantum_dev'}`
          : '',
      });

      showToast(
        isPersonal ? 'Saved privately to Personal Space' : 'Published to Quad campus network',
        'success'
      );
      setTitle('');
      setContent('');
      setHasPhoto(false);
      setUploadedMedia(null);
      setImageAlt('');
      onComplete?.();
    } catch (err) {
      showToast(err?.message || 'Unable to publish post', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Post Type Chips */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink/60">Post Category</p>
        <div className="flex flex-wrap gap-2">
          {POST_TYPES.map((type) => {
            const active = postType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                aria-pressed={active}
                className={`min-h-[44px] px-3 py-2 rounded-full text-xs font-semibold border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active
                    ? 'bg-ink text-canvas border-ink'
                    : 'bg-ink/6 text-ink border-ink/12 hover:bg-ink/8'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audience Status Strip */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-[12px] bg-ink/6 border border-ink/12">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink">Audience:</span>
          <Badge variant="status" icon={selectedAudience.icon}>
            {selectedAudience.label}
          </Badge>
        </div>
        <span className="text-xs text-ink/60 font-medium hidden sm:inline-flex items-center gap-1">
          <ShieldCheck size={16} className="text-ink" />
          <span>Verified Handle Only</span>
        </span>
      </div>

      {/* Title + Body Composer */}
      <Card padding={false} className="p-4 bg-canvas border border-ink/12 rounded-[12px] space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short headline (optional)"
          maxLength={100}
          className="w-full min-h-[44px] border-b border-ink/12 pb-2 bg-transparent text-base font-semibold text-ink placeholder:text-ink/40 focus:outline-none focus:border-accent"
        />

        <textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What would you like to share with campus peers? Add #hashtags naturally..."
          className="w-full bg-transparent resize-none text-sm text-ink placeholder:text-ink/40 focus:outline-none leading-relaxed"
        />

        {hasPhoto && (
          <div className="rounded-[12px] border border-ink/12 bg-ink/6 p-3 space-y-3">
            {uploadedMedia?.url && (
              <div className="aspect-video w-full rounded-[8px] overflow-hidden border border-ink/12 bg-canvas">
                <img
                  src={resolveApiMediaUrl(uploadedMedia.url)}
                  alt={imageAlt || 'EXIF-stripped campus photo preview'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[8px] bg-canvas border border-ink/12 text-ink flex items-center justify-center shrink-0">
                  <ImageIcon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {uploadedMedia?.fileName || 'attached_campus_photo.jpg'}
                  </p>
                  <p className="text-xs text-ink/60 flex items-center gap-1">
                    <MapPinOff size={16} className="text-ink shrink-0" />
                    <span>
                      {uploadedMedia?.strippedBytes > 0
                        ? `EXIF & GPS stripped (${uploadedMedia.strippedBytes} bytes scrubbed)`
                        : 'EXIF & GPS coordinates automatically stripped on upload'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasPhoto(false);
                  setUploadedMedia(null);
                }}
                aria-label="Remove attached photo"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] text-ink/60 hover:text-danger hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-ink/60 flex items-center gap-1">
                  <MapPin size={16} />
                  <span>Campus location label (optional)</span>
                </span>
                <input
                  type="text"
                  value={locationTag}
                  onChange={(e) => setLocationTag(e.target.value)}
                  placeholder="e.g. Library Hall, East Wing"
                  className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-canvas border border-ink/12 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-ink/60">Alt text description</span>
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Describe the image for screen readers"
                  className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-canvas border border-ink/12 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFilePick}
          className="hidden"
        />

        <div className="flex items-center justify-between pt-2 border-t border-ink/12 text-xs gap-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              if (hasPhoto) {
                setHasPhoto(false);
                setUploadedMedia(null);
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="min-h-[44px] px-2 rounded-[8px] inline-flex items-center gap-2 text-accent font-semibold hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <ImageIcon size={16} strokeWidth={2} />
            <span>
              {isUploading ? 'Scrubbing EXIF...' : hasPhoto ? 'Remove Photo' : 'Attach Photo'}
            </span>
          </button>

          <span className={overLimit ? 'text-danger font-bold' : 'text-ink/60'}>
            {charsLeft} characters remaining
          </span>
        </div>
      </Card>

      {/* EXIF Stripping Guarantee moved to upload composer */}
      <ShieldBanner
        type="info"
        icon={MapPinOff}
        message="Upload Privacy Guard: EXIF metadata, camera serials, and exact GPS coordinates are automatically stripped from every uploaded photo."
      />

      {/* Audience Selector Grid */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink/60">Select Audience</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AUDIENCES.map((opt) => {
            const Icon = opt.icon;
            const isSelected = audience === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAudience(opt.id)}
                aria-pressed={isSelected}
                className={`min-h-[44px] p-3 rounded-[8px] border text-left transition-colors duration-150 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'border-accent bg-ink/6'
                    : 'border-ink/12 bg-canvas hover:bg-ink/8'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Icon
                    size={16}
                    className={isSelected ? 'text-accent' : 'text-ink/60'}
                  />
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center text-canvas">
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <p className={`text-xs font-semibold ${isSelected ? 'text-accent' : 'text-ink'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-ink/60 mt-1 line-clamp-2">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-ink/12">
        {onCancel && (
          <Button variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          icon={Send}
          onClick={handlePost}
          disabled={isEmpty || overLimit}
        >
          Publish Post
        </Button>
      </div>
    </div>
  );
}

export function CreatePostModal({ isOpen, onClose, onCreated }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Campus Post"
      description="Share a question, tip, resource, event, or discussion with verified peers."
      size="lg"
    >
      <div className="max-h-[75vh] overflow-y-auto scrollbar-hover pr-1">
        <CreatePostForm
          onComplete={() => {
            onClose?.();
            onCreated?.();
          }}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}

export default function CreatePostScreen({ onNavigate }) {
  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-ink/12">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Create Campus Post
          </h2>
          <p className="text-xs text-ink/60 mt-1">
            Publish to public campus feed or private circles
          </p>
        </div>
      </div>

      <CreatePostForm
        onComplete={() => onNavigate?.('feed')}
        onCancel={() => onNavigate?.('feed')}
      />
    </div>
  );
}
