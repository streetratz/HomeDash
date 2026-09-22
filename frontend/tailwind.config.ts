import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import tailwindcssTypography from '@tailwindcss/typography';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        status: {
          info: 'hsl(var(--status-info))',
          success: 'hsl(var(--status-success))',
          warning: 'hsl(var(--status-warning))',
          danger: 'hsl(var(--status-danger))',
          purple: 'hsl(var(--status-purple))',
          cyan: 'hsl(var(--status-cyan))',
        },
        widget: {
          fg: 'hsl(var(--widget-fg))',
          'fg-muted': 'hsl(var(--widget-fg-muted))',
          'fg-dim': 'hsl(var(--widget-fg-dim))',
          'bg-subtle': 'hsl(var(--widget-bg-subtle))',
          'bg-hover': 'hsl(var(--widget-bg-hover))',
          border: 'hsl(var(--widget-border))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-scroll': {
          '0%, 10%': { transform: 'translateX(0)' },
          '90%, 100%': { transform: 'translateX(calc(-100% + 12rem))' },
        },
      },
      animation: {
        marquee: 'marquee 12s linear infinite',
        'marquee-scroll': 'marquee-scroll 4s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    tailwindcssTypography,
    // Custom variant: `can-hover:` — only applies on devices with hover capability
    function ({ addVariant }: { addVariant: (name: string, rule: string) => void }) {
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)');
    },
  ],
};

export default config;
