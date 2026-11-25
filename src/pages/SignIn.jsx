import { safeAuthReturn, authLink } from "@/lib/authReturn";
import { isNewShell } from "@/lib/flags";
import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/shell/clerkAppearance";
import { SignIn as ClerkSignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

const SignIn = () => {
  const [searchParams] = useSearchParams();
  const afterSignInUrl = safeAuthReturn(searchParams.get("redirect_url") || "/");
  const signUpUrl = authLink("/sign-up", afterSignInUrl);
  const appearance = isNewShell() ? clerkAppearance : { elements: { rootBox: "mx-auto", card: "shadow-2xl rounded-2xl" } };
  return <AuthFrame><AuthFeedback><ClerkSignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} forceRedirectUrl={afterSignInUrl} fallbackRedirectUrl={afterSignInUrl} appearance={appearance} /></AuthFeedback></AuthFrame>;
};
export default SignIn;
