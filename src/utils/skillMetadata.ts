/**
 * Skill Category Metadata
 * Centralized mappings for skill categories to colors and badges
 */

export type SkillCategory = 'trading' | 'analysis' | 'utility' | 'social' | string;

/**
 * Get color for skill category
 */
export function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'trading':
      return 'green';
    case 'analysis':
      return 'blue';
    case 'utility':
      return 'purple';
    case 'social':
      return 'orange';
    default:
      return 'gray';
  }
}

/**
 * Get badge class for skill category
 */
export function getCategoryBadgeClass(category: string): string {
  const color = getCategoryColor(category);

  // Static Tailwind class map
  const badgeMap: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  return badgeMap[color] || badgeMap.gray;
}

/**
 * Get all metadata for a category at once
 */
export function getCategoryMetadata(category: string) {
  return {
    color: getCategoryColor(category),
    badgeClass: getCategoryBadgeClass(category),
  };
}
