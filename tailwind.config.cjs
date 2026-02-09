/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#2c5bf6",
                "beige": "#ece9d8",
                "panel": "#ffffff",
                "text-main": "#1f2937",
                "text-muted": "#6b7280",
                // Keeping legacy mappings for safety temporarily, pointing to new palette
                "active": "#1f2937",
                "canvas": "#ece9d8",
                "card": "#ffffff",
            },
            fontFamily: {
                "display": ["Outfit", "sans-serif"],
                "body": ["Inter", "sans-serif"],
            },
            borderRadius: {
                "lg": "12px",
                "xl": "16px",
            },
            boxShadow: {
                "soft": "2px 2px 5px rgba(0,0,0,0.05), -1px -1px 4px rgba(255,255,255,0.8)",
                "bevel": "inset 1px 1px 0px rgba(255,255,255,0.7), inset -1px -1px 0px rgba(0,0,0,0.05)",
                "well": "inset 2px 2px 5px rgba(0,0,0,0.05), inset -1px -1px 4px rgba(255,255,255,0.8)",
                "button": "2px 2px 0px rgba(0,0,0,0.1)",
                "input": "inset 2px 2px 4px rgba(0,0,0,0.05), inset -1px -1px 2px rgba(255,255,255,0.8)",
            },
            keyframes: {
                ticker: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                slideDown: {
                    'from': { opacity: '0', transform: 'translateY(-5px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                }
            },
            animation: {
                ticker: 'ticker 30s linear infinite',
                slideDown: 'slideDown 0.2s ease-out forwards',
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
