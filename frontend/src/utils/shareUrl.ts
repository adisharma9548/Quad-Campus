/**
 * Quad Canonical URL & Sharing Utility (Phase 3)
 * Unified source of truth for deep links, canonical query parameters, and device sharing.
 */

export interface ShareUrlOptions {
  type?: 'post' | 'reel' | 'user' | 'thread' | 'screen';
  screen?: string;
  id?: string | number;
  username?: string;
  tab?: string;
  q?: string;
  customPath?: string;
}

export interface ParsedRouteParams {
  screen: string;
  reelId?: string;
  postId?: string;
  username?: string;
  threadId?: string;
  tab?: string;
  query?: string;
}

/**
 * Builds a canonical Quad URL for sharing and history navigation.
 */
export function buildShareUrl(options: ShareUrlOptions): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (options.customPath) {
    return `${origin}${options.customPath}`;
  }

  const params = new URLSearchParams();

  if (options.type === 'reel' || (options.screen === 'reels' && options.id)) {
    params.set('screen', 'reels');
    if (options.id) params.set('reel', String(options.id));
  } else if (options.type === 'post' || (options.screen === 'post' && options.id)) {
    params.set('screen', 'feed');
    if (options.id) params.set('post', String(options.id));
  } else if (options.type === 'user' || (options.screen === 'profile' && options.username)) {
    params.set('screen', 'profile');
    if (options.username) params.set('user', options.username);
  } else if (options.type === 'thread' || (options.screen === 'threads' && options.id)) {
    params.set('screen', 'threads');
    if (options.id) params.set('thread', String(options.id));
  } else if (options.screen) {
    params.set('screen', options.screen);
    if (options.tab) params.set('tab', options.tab);
    if (options.q) params.set('q', options.q);
    if (options.id) params.set('id', String(options.id));
  } else {
    params.set('screen', 'feed');
  }

  const qs = params.toString();
  return qs ? `${origin}/?${qs}` : `${origin}/`;
}

/**
 * Safely copies text to the system clipboard across modern and legacy browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to DOM execCommand
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Shares content via Web Share API or falls back to copying the canonical URL.
 */
export async function shareContent({
  title = 'Quad',
  text,
  url,
  onToast,
}: {
  title?: string;
  text?: string;
  url: string;
  onToast?: (message: string, variant?: 'success' | 'error' | 'info') => void;
}): Promise<void> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      onToast?.('Shared successfully', 'success');
      return;
    } catch (err: unknown) {
      // AbortError is thrown when the user dismisses the system share dialog
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }
  }

  const copied = await copyToClipboard(url);
  if (copied) {
    onToast?.('Link copied to clipboard', 'success');
  } else {
    onToast?.('Could not copy link to clipboard', 'error');
  }
}

/**
 * Parses current window location into structured route parameters.
 */
export function parseLocation(): ParsedRouteParams {
  if (typeof window === 'undefined') {
    return { screen: 'feed' };
  }

  const pathname = window.location.pathname.replace(/\/+$/, '');
  if (pathname === '/terms' || pathname === '/privacy') {
    return { screen: 'terms' };
  }
  if (pathname === '/safety') {
    return { screen: 'safety' };
  }
  if (pathname === '/admin') {
    return { screen: 'admin' };
  }

  const params = new URLSearchParams(window.location.search);
  const rawScreen = params.get('screen') || 'feed';

  // Support both ?screen=post&id=X and ?screen=feed&post=X
  let screen = rawScreen;
  let postId: string | undefined;
  if (rawScreen === 'post') {
    screen = 'feed';
    postId = params.get('id') || undefined;
  } else {
    postId = params.get('post') || undefined;
  }

  const reelId = params.get('reel') || undefined;
  const username = params.get('user') || undefined;
  const threadId = params.get('thread') || undefined;
  const tab = params.get('tab') || undefined;
  const query = params.get('q') || undefined;

  return {
    screen,
    reelId,
    postId,
    username,
    threadId,
    tab,
    query,
  };
}
