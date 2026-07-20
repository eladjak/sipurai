import { lazy } from 'react';
import __Layout from './Layout.jsx';

// All pages are lazy-loaded for code splitting.
// Home is included here — it's heavy (gamification, AI hooks, charts) and the auth
// guard in AuthenticatedApp already shows a spinner before it renders.
const Home = lazy(() => import('./pages/Home'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const BookCreation = lazy(() => import('./pages/BookCreation'));
const BookView = lazy(() => import('./pages/BookView'));
const BookWizard = lazy(() => import('./pages/BookWizard'));
const CharacterEditor = lazy(() => import('./pages/CharacterEditor'));
const Characters = lazy(() => import('./pages/Characters'));
const Community = lazy(() => import('./pages/Community'));
const CommunityPost = lazy(() => import('./pages/CommunityPost'));
const Feedback = lazy(() => import('./pages/Feedback'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const StoryIdeas = lazy(() => import('./pages/StoryIdeas'));
const Contact = lazy(() => import('./pages/Contact'));
const Pricing = lazy(() => import('./pages/Pricing'));
const AccessibilityStatement = lazy(() => import('./pages/AccessibilityStatement'));

export const PAGES = {
    "Blog": Blog,
    "BlogPost": BlogPost,
    "BookCreation": BookCreation,
    "PrivacyPolicy": PrivacyPolicy,
    "TermsOfService": TermsOfService,
    "BookView": BookView,
    "BookWizard": BookWizard,
    "CharacterEditor": CharacterEditor,
    "Characters": Characters,
    "Community": Community,
    "CommunityPost": CommunityPost,
    "Feedback": Feedback,
    "Home": Home,
    "LandingPage": LandingPage,
    "Leaderboard": Leaderboard,
    "Library": Library,
    "Profile": Profile,
    "Settings": Settings,
    "StoryIdeas": StoryIdeas,
    "Contact": Contact,
    "Pricing": Pricing,
    "Accessibility": AccessibilityStatement,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
