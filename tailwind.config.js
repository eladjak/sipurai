/** @type {import('tailwindcss').Config} */
module.exports = {
    // Emits hover: utilities inside (hover: hover) so a tap cannot latch a
    // hover state on touch devices.
    future: { hoverOnlyWhenSupported: true },
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Nunito', 'sans-serif'],
  			heading: ['Fredoka', 'sans-serif'],
			'sp-display': ['var(--sp-font-display)', 'Rubik', 'system-ui', 'sans-serif'],
			'sp-body': ['var(--sp-font-body)', 'system-ui', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
			'sp-sm': 'var(--sp-r-sm)',
			'sp-md': 'var(--sp-r-md)',
			'sp-lg': 'var(--sp-r-lg)',
			'sp-pill': 'var(--sp-r-pill)'
  		},
  		colors: {
			sp: {
				night: { '900': 'var(--sp-night-900)', '800': 'var(--sp-night-800)', '700': 'var(--sp-night-700)' },
				violet: { '700': 'var(--sp-violet-700)', '600': 'var(--sp-violet-600)', '500': 'var(--sp-violet-500)', '100': 'var(--sp-violet-100)', '50': 'var(--sp-violet-50)' },
				gold: { '400': 'var(--sp-gold-400)', '300': 'var(--sp-gold-300)' },
				cream: { '100': 'var(--sp-cream-100)', '50': 'var(--sp-cream-50)' },
				ink: { '900': 'var(--sp-ink-900)', '600': 'var(--sp-ink-600)', '500': 'var(--sp-ink-500)', '400': 'var(--sp-ink-400)' },
				paper: 'var(--sp-paper)',
				card: 'var(--sp-card)',
				line: 'var(--sp-line)',
				'on-night': { DEFAULT: 'var(--sp-on-night)', muted: 'var(--sp-on-night-muted)' },
				danger: { DEFAULT: 'var(--sp-danger)', '50': 'var(--sp-danger-50)' },
				success: { DEFAULT: 'var(--sp-success)', '50': 'var(--sp-success-50)' }
			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		boxShadow: {
			'sp-1': 'var(--sp-shadow-1)',
			'sp-2': 'var(--sp-shadow-2)'
		},
		fontSize: {
			'sp-xs': ['13px', { lineHeight: '1.5' }],
			'sp-sm': ['15px', { lineHeight: '1.55' }],
			'sp-base': ['16px', { lineHeight: '1.6' }],
			'sp-lg': ['20px', { lineHeight: '1.4' }],
			'sp-xl': ['24px', { lineHeight: '1.3' }],
			'sp-2xl': ['28px', { lineHeight: '1.25' }],
			'sp-3xl': ['34px', { lineHeight: '1.2' }]
		},
		transitionTimingFunction: {
			'sp-out': 'var(--sp-ease-out)'
		},
		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}