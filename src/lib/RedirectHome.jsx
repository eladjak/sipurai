import { Navigate, useLocation } from "react-router-dom";

/**
 * Paths that used to be the signed-in home ("Dashboard") and may still be
 * linked, bookmarked, or configured as an after-sign-in URL in the Clerk
 * dashboard. The home page is "/". React Router matches paths case-insensitively,
 * so "/Dashboard" also covers "/dashboard".
 */
export const LEGACY_HOME_PATHS = ["/Dashboard"];

/** Sends the visitor to "/" and keeps the query string and hash. */
export default function RedirectHome() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/", search, hash }} replace />;
}
