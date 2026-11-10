// @ts-check

/**
 * Common selectors for the Sipurai app.
 *
 * Prefer role-based and text-based selectors over CSS/XPath selectors for
 * resilience against UI refactoring.
 */

// ---------------------------------------------------------------------------
// Sidebar / Navigation
// ---------------------------------------------------------------------------

/** The sidebar brand logo link text */
export const SIDEBAR_BRAND = 'text=Sipurai';

/** Sidebar nav section headings (English) */
export const NAV_SECTIONS = {
  main: 'text=MAIN',
  create: 'text=CREATE',
  mySpace: 'text=MY SPACE',
  community: 'text=COMMUNITY',
  system: 'text=SYSTEM',
};

/** Sidebar navigation links — using button text */
export const NAV_LINKS = {
  home: 'nav >> text=Home',
  createBook: 'nav >> text=Create Book',
  advancedEditor: 'nav >> text=Advanced Editor',
  characters: 'nav >> text=Characters',
  myLibrary: 'nav >> text=My Library',
  myProfile: 'nav >> text=My Profile',
  community: 'nav >> text=Community',
  leaderboard: 'nav >> text=Leaderboard',
  settings: 'nav >> text=Settings',
};

/** Dark mode toggle button (contains Sun or Moon icon) */
export const DARK_MODE_BUTTON = 'button:has(.lucide-moon), button:has(.lucide-sun)';

/** Logout button */
export const LOGOUT_BUTTON = 'button:has-text("Logout"), button:has-text("Sign out")';

// ---------------------------------------------------------------------------
// Common page elements
// ---------------------------------------------------------------------------

/** Page heading — the main <h1> or prominent heading on any page */
export const PAGE_HEADING = 'h1, h2.font-bold, [role="heading"]';

/** Loading skeleton — indicates the page is still loading */
export const LOADING_SKELETON = '[class*="skeleton"], [class*="animate-pulse"]';

/** Empty state component on Library / Community pages */
export const EMPTY_STATE = '[class*="EmptyState"], text=No books found, text=No stories yet';

/** Search input */
export const SEARCH_INPUT = 'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]';

/** Filter controls */
export const FILTER_BUTTON = 'button:has-text("Filter"), button:has-text("Filters")';

// ---------------------------------------------------------------------------
// Book Wizard
// ---------------------------------------------------------------------------

/** The wizard progress/steps navigation */
export const WIZARD_PROGRESS = '[role="navigation"][aria-label*="steps"], [role="navigation"][aria-label*="שלבי"]';

/** Topic cards in Step 1 */
export const TOPIC_CARD = '[class*="topic"], button[class*="rounded"], .cursor-pointer';

/** "Next" button in the wizard */
export const WIZARD_NEXT = 'button:has-text("Next"), button:has-text("Continue"), button:has-text("הבא")';

/** "Back" button in the wizard */
export const WIZARD_BACK = 'button:has-text("Back"), button:has-text("Previous"), button:has-text("חזור")';

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

/** Share book button */
export const SHARE_BUTTON = 'button:has-text("Share"), button:has-text("שתף")';

/** Featured section */
export const FEATURED_SECTION = 'text=Featured, text=מומלץ, [class*="featured"]';

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

/** Book card in the library */
export const BOOK_CARD = '[class*="BookCard"], [class*="book-card"], article[class*="card"]';

/** "Create New Book" link/button */
export const CREATE_BOOK_BUTTON = 'text=Create New Book, a[href*="BookWizard"], a[href*="wizard"]';
