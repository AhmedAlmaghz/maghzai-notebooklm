/**
 * Sharing Service
 * Enables sharing notebooks and notes with other users
 */

export interface ShareOptions {
  notebookId: string;
  noteId?: string;
  permission: "view" | "edit" | "admin";
  expiresAt?: Date;
  maxUses?: number;
}

export interface ShareLink {
  id: string;
  notebookId: string;
  noteId?: string;
  permission: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  useCount: number;
  url: string;
}

/**
 * Generate a shareable link
 */
export function generateShareLink(options: ShareOptions): ShareLink {
  const shareId = generateShareId();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  
  const link: ShareLink = {
    id: shareId,
    notebookId: options.notebookId,
    noteId: options.noteId,
    permission: options.permission,
    createdAt: new Date(),
    expiresAt: options.expiresAt,
    maxUses: options.maxUses,
    useCount: 0,
    url: `${baseUrl}/shared/${shareId}`,
  };

  // Store in localStorage (in production, this would be in a database)
  if (typeof window !== "undefined") {
    const shares = getStoredShares();
    shares.push(link);
    localStorage.setItem("notebook_shares", JSON.stringify(shares));
  }

  return link;
}

/**
 * Get all share links for a notebook
 */
export function getShareLinks(notebookId: string): ShareLink[] {
  const shares = getStoredShares();
  return shares.filter(s => s.notebookId === notebookId);
}

/**
 * Revoke a share link
 */
export function revokeShareLink(shareId: string): boolean {
  if (typeof window === "undefined") return false;
  
  const shares = getStoredShares();
  const filtered = shares.filter(s => s.id !== shareId);
  localStorage.setItem("notebook_shares", JSON.stringify(filtered));
  return true;
}

/**
 * Validate a share link
 */
export function validateShareLink(shareId: string): ShareLink | null {
  const shares = getStoredShares();
  const link = shares.find(s => s.id === shareId);
  
  if (!link) return null;
  
  // Check expiration
  if (link.expiresAt && new Date() > link.expiresAt) {
    return null;
  }
  
  // Check max uses
  if (link.maxUses && link.useCount >= link.maxUses) {
    return null;
  }
  
  return link;
}

/**
 * Increment use count for a share link
 */
export function incrementShareUse(shareId: string): void {
  if (typeof window === "undefined") return;
  
  const shares = getStoredShares();
  const link = shares.find(s => s.id === shareId);
  if (link) {
    link.useCount++;
    localStorage.setItem("notebook_shares", JSON.stringify(shares));
  }
}

/**
 * Copy share link to clipboard
 */
export async function copyShareLink(shareLink: ShareLink): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareLink.url);
    return true;
  } catch (error) {
    console.error("Failed to copy link:", error);
    return false;
  }
}

/**
 * Share via Web Share API (mobile)
 */
export async function shareViaWebAPI(shareLink: ShareLink, title: string): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    await navigator.share({
      title: title,
      text: `Check out this notebook: ${title}`,
      url: shareLink.url,
    });
    return true;
  } catch (error) {
    console.error("Failed to share:", error);
    return false;
  }
}

/**
 * Generate a unique share ID
 */
function generateShareId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

/**
 * Get stored shares from localStorage
 */
function getStoredShares(): ShareLink[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem("notebook_shares");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Check if sharing is supported
 */
export function isSharingSupported(): boolean {
  return typeof window !== "undefined" && !!navigator.share;
}

/**
 * Get sharing options available
 */
export function getSharingOptions(): Array<{ id: string; label: string; icon: string }> {
  const options = [
    { id: "copy", label: "نسخ الرابط", icon: "📋" },
    { id: "view", label: "صلاحيات مشاهدة", icon: "👁️" },
    { id: "edit", label: "صلاحيات تعديل", icon: "✏️" },
  ];

  if (isSharingSupported()) {
    options.push({ id: "native", label: "مشاركة النظام", icon: "📤" });
  }

  return options;
}