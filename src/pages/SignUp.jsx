import { safeAuthReturn, authLink } from "@/lib/authReturn";
import { isNewShell } from "@/lib/flags";
import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/shell/clerkAppearance";
import { SignUp as ClerkSignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const afterSignUpUrl = safeAuthReturn(searchParams.get("redirect_url"));
  const signInUrl = authLink("/sign-in", afterSignUpUrl);
  const appearance = isNewShell() ? clerkAppearance : { elements: { rootBox: "mx-auto", card: "shadow-2xl rounded-2xl" } };
  return <AuthFrame><AuthFeedback><ClerkSignUp routing="path" path="/sign-up" signInUrl={signInUrl} forceRedirectUrl={afterSignUpUrl} fallbackRedirectUrl={afterSignUpUrl} appearance={appearance} /></AuthFeedback></AuthFrame>;
};
export default SignUp;
