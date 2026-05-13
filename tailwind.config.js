/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    darkMode: ['selector', '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                base: 'var(--color-base)',
                surface: 'var(--color-surface)',
                muted: 'var(--color-muted)',
                brand: {
                    DEFAULT: 'var(--color-brand)',
                    light: 'var(--color-brand-light)',
                    dark: 'var(--color-brand-dark)',
                },
                type: {
                    photo: 'var(--color-type-photo)',
                    video: 'var(--color-type-video)',
                    voice: 'var(--color-type-voice)',
                    chat: 'var(--color-type-chat)',
                },
            },
            borderRadius: {
                'xl': '16px',
                '2xl': '20px',
            }
        }
    },
    plugins: [],
}