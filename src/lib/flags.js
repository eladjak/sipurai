// Build-time switch for the new interface shell (UX overhaul, phase 1).
// The test is a module-level constant on the literal env expression so the
// bundler can drop new-shell code when the variable is not "true".
// Only the exact string "true" turns it on; unset, "1", "TRUE" are all off.
export const NEW_SHELL_ENV_NAME = "VITE_NEW_SHELL";

const NEW_SHELL = import.meta.env.VITE_NEW_SHELL === "true";

export const isNewShell = () => NEW_SHELL;
