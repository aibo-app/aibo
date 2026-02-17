import { EXTERNAL_URLS } from '../lib/constants';

/**
 * Generate a deterministic avatar URL based on a seed string
 * Uses DiceBear's identicon style for consistent wallet/account avatars
 *
 * @param seed - Unique identifier (wallet address, account name, etc.)
 * @returns Complete avatar URL
 */
export function generateAvatarUrl(seed: string): string {
  return `${EXTERNAL_URLS.DICEBEAR_AVATAR}?seed=${encodeURIComponent(seed)}`;
}

/**
 * Get fallback initials from a name/address for alt text
 * @param name - Name or address to extract initials from
 * @returns 1-2 character initials
 */
export function getInitials(name: string): string {
  if (!name) return '?';

  const cleaned = name.trim();
  const words = cleaned.split(/\s+/);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}
