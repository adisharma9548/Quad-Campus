import type { ThreadReply } from '../types/quad';

export function countReplySubtree(node: ThreadReply): number {
  const children = node.replies || [];
  let count = 1;
  for (const child of children) {
    count += countReplySubtree(child);
  }
  return count;
}

export function countDescendants(node: ThreadReply): number {
  const children = node.replies || [];
  let count = children.length + (node.hiddenReplyCount || 0);
  for (const child of children) {
    count += countDescendants(child) - (child.hiddenReplyCount || 0);
  }
  return count;
}

export function insertReplyIntoTree(
  nodes: ThreadReply[],
  parentCommentId: string | number | null | undefined,
  newReply: ThreadReply
): ThreadReply[] {
  if (!parentCommentId) {
    return [...nodes, newReply];
  }
  return nodes.map((node) => {
    if (String(node.id) === String(parentCommentId)) {
      return {
        ...node,
        replies: [...(node.replies || []), newReply],
      };
    }
    if (node.replies && node.replies.length > 0) {
      return {
        ...node,
        replies: insertReplyIntoTree(node.replies, parentCommentId, newReply),
      };
    }
    return node;
  });
}

export function replaceTempReplyInTree(
  nodes: ThreadReply[],
  tempId: string | number,
  savedReply: ThreadReply
): ThreadReply[] {
  return nodes.map((node) => {
    if (String(node.id) === String(tempId)) {
      return {
        ...savedReply,
        replies: node.replies && node.replies.length > 0 ? node.replies : savedReply.replies || [],
      };
    }
    if (node.replies && node.replies.length > 0) {
      return {
        ...node,
        replies: replaceTempReplyInTree(node.replies, tempId, savedReply),
      };
    }
    return node;
  });
}

export function removeReplyFromTree(
  nodes: ThreadReply[],
  targetId: string | number
): { nodes: ThreadReply[]; changed: boolean; softDeleted: boolean } {
  let changed = false;
  let softDeleted = false;
  const next: ThreadReply[] = [];

  for (const node of nodes) {
    if (String(node.id) === String(targetId)) {
      changed = true;
      const hasChildren = (node.replies && node.replies.length > 0) || Boolean(node.hasMoreReplies);
      if (hasChildren) {
        softDeleted = true;
        next.push({
          ...node,
          username: '[deleted]',
          initials: 'DEL',
          content: '[deleted]',
          body: '[deleted]',
          isDeleted: true,
        });
      }
      continue;
    }

    if (node.replies && node.replies.length > 0) {
      const res = removeReplyFromTree(node.replies, targetId);
      if (res.changed) {
        changed = true;
        softDeleted = res.softDeleted;
        next.push({ ...node, replies: res.nodes });
        continue;
      }
    }
    next.push(node);
  }

  return { nodes: next, changed, softDeleted };
}

export function mergeBranchChildren(
  nodes: ThreadReply[],
  parentCommentId: string | number,
  children: ThreadReply[]
): ThreadReply[] {
  return nodes.map((node) => {
    if (String(node.id) === String(parentCommentId)) {
      return {
        ...node,
        replies: children,
        hasMoreReplies: false,
        hiddenReplyCount: 0,
      };
    }
    if (node.replies && node.replies.length > 0) {
      return {
        ...node,
        replies: mergeBranchChildren(node.replies, parentCommentId, children),
      };
    }
    return node;
  });
}

export function setReplyReportedInTree(
  nodes: ThreadReply[],
  targetId: string | number,
  reportedByMe: boolean
): ThreadReply[] {
  return nodes.map((node) => {
    const matches = String(node.id) === String(targetId);
    const updatedChildren =
      node.replies && node.replies.length > 0
        ? setReplyReportedInTree(node.replies, targetId, reportedByMe)
        : node.replies;
    if (matches || updatedChildren !== node.replies) {
      return {
        ...node,
        reportedByMe: matches ? reportedByMe : node.reportedByMe,
        replies: updatedChildren,
      };
    }
    return node;
  });
}
