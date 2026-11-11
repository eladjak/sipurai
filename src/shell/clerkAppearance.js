// Clerk's stable appearance element keys: https://clerk.com/docs/guides/customizing-clerk/appearance-prop/overview
export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--sp-violet-600)',
    colorText: 'var(--sp-ink-900)',
    colorBackground: 'var(--sp-card)',
    borderRadius: 'var(--sp-r-sm)',
    fontFamily: 'var(--sp-font-body)',
  },
  elements: {
    rootBox: { width: '100%', maxWidth: '26rem' },
    card: { borderRadius: 'var(--sp-r-lg)', boxShadow: 'var(--sp-shadow-2)' },
    headerTitle: { fontFamily: 'var(--sp-font-display)' },
    formButtonPrimary: {
      minHeight: '44px', backgroundColor: 'var(--sp-violet-600)',
      '&:hover': { backgroundColor: 'var(--sp-violet-700)' },
      '[dir="rtl"] & svg': { transform: 'scaleX(-1)' },
    },
    socialButtonsBlockButton: { minHeight: '44px' },
    formFieldInput: { minHeight: '44px' },
    formFieldInputShowPasswordButton: { minWidth: '44px', minHeight: '44px' },
    footerActionLink: { display: 'inline-flex', alignItems: 'center', minHeight: '44px', minWidth: '44px' },
    footer: { color: 'var(--sp-ink-600)', '& a': { display: 'inline-flex', alignItems: 'center', minHeight: '44px', minWidth: '44px' } },
  },
};
