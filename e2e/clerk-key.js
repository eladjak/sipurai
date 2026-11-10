// The Clerk PUBLISHABLE key is public by design (it is embedded in every page the site serves),
// so it is safe to keep a default here. This is the DEV instance, never the live one.
// Override with the environment variable CLERK_PUBLISHABLE_KEY (CI: repository variable of the same name).
export const DEV_PUBLISHABLE_KEY = 'pk_test_bWFueS1saWdlci0yOS5jbGVyay5hY2NvdW50cy5kZXYk';

export const publishableKey = () => process.env.CLERK_PUBLISHABLE_KEY || DEV_PUBLISHABLE_KEY;
