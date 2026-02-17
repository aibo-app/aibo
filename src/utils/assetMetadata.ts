import { ASSET_LOGOS } from '../lib/constants';

/**
 * Asset Metadata Utilities
 * Centralized mappings for asset symbols to icons, colors, and logos
 */

export type AssetSymbol = 'BTC' | 'ETH' | 'SOL' | 'USDC' | 'USDT' | 'JUP' | string;
export type AssetColor = 'orange' | 'blue' | 'purple' | 'green' | 'gray' | 'red';

/**
 * Get icon character for asset symbol
 */
export function getAssetIcon(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();

  switch (upperSymbol) {
    case 'BTC':
      return '₿';
    case 'ETH':
      return 'Ξ';
    case 'SOL':
      return '◎';
    case 'USDC':
    case 'USDT':
      return '$';
    default:
      return '●';
  }
}

/**
 * Get color for asset symbol
 */
export function getAssetColor(symbol: string): AssetColor {
  const upperSymbol = symbol.toUpperCase();

  switch (upperSymbol) {
    case 'BTC':
      return 'orange';
    case 'ETH':
      return 'blue';
    case 'SOL':
      return 'purple';
    case 'USDC':
    case 'USDT':
      return 'green';
    default:
      return 'gray';
  }
}

/**
 * Get logo URL for asset symbol
 */
export function getAssetLogo(symbol: string): string | null {
  const upperSymbol = symbol.toUpperCase() as keyof typeof ASSET_LOGOS;
  return ASSET_LOGOS[upperSymbol] || null;
}

/**
 * Get Tailwind color class for asset
 */
export function getAssetColorClass(symbol: string): string {
  const color = getAssetColor(symbol);

  // Static Tailwind class map (dynamic classes are stripped at build time)
  const colorMap: Record<AssetColor, string> = {
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  };

  return colorMap[color];
}

/**
 * Get background color class for asset
 */
export function getAssetBgClass(symbol: string): string {
  const color = getAssetColor(symbol);

  const bgMap: Record<AssetColor, string> = {
    orange: 'bg-orange-100',
    blue: 'bg-blue-100',
    purple: 'bg-purple-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    gray: 'bg-gray-100',
  };

  return bgMap[color];
}

/**
 * Get all metadata for an asset at once
 */
export function getAssetMetadata(symbol: string) {
  return {
    icon: getAssetIcon(symbol),
    color: getAssetColor(symbol),
    logo: getAssetLogo(symbol),
    colorClass: getAssetColorClass(symbol),
    bgClass: getAssetBgClass(symbol),
  };
}
