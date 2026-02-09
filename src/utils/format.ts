/**
 * Converts snake_case_strings to Title Case Strings.
 * Handles existing camelCase and spaces gracefully.
 */
export const toTitleCase = (str: string): string => {
    if (!str) return '';

    // Replace underscores with spaces
    const withSpaces = str.replace(/_/g, ' ');

    // Split by spaces and capitalize each word
    return withSpaces
        .split(' ')
        .map(word => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
};

/**
 * Formats currency values with shorthand notation (K, M, B, T)
 */
export const formatCurrency = (value: number, minimumFractionDigits = 2): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
        notation: value > 1000000 ? 'compact' : 'standard'
    }).format(value);
};
