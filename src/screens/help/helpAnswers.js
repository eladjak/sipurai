// Every answer is grounded in existing product behaviour or policy.
export const answers = [
  { id: 'story', source: 'src/screens/new-story/NewStory.jsx; src/screens/new-story/useNewStory.js' },
  { id: 'gift', source: 'src/lib/bookQuota.js; src/components/i18n/locales/he/newStory.js' },
  { id: 'read', source: 'src/screens/shelf/Shelf.jsx; src/screens/reader/NightReader.jsx' },
  { id: 'print', source: 'src/pages/PrintCheckout.jsx; src/App.jsx', print: true },
  { id: 'privacy', source: 'src/data/privacyPolicyContent.js' },
  { id: 'delete', source: 'src/components/settings/AccountDataControls.jsx; src/components/settings/DeleteAccountCard.jsx' },
  { id: 'accessibility', source: 'src/pages/AccessibilityStatement.jsx' },
];
