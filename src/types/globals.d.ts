// Browser globals this app uses that lib.dom does not know about.
interface Window {
  /** Umami analytics, injected by a <script> tag; absent until it loads or when blocked. */
  umami?: { track: (name: string, properties?: Record<string, unknown>) => void };
}
interface Navigator {
  /** Old Internet Explorer / Edge language property, read as a fallback in i18nProvider. */
  userLanguage?: string;
}

// api/_lib/modelRegistry.js is shared with the browser bundle and reads process.env on the server only.
declare const process: { env: Record<string, string | undefined> };
