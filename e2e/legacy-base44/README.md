These specs were written for the retired Base44 login and test a sidebar ("Sipurai") that no longer
exists after sign-in moved to Clerk. They skip themselves when the shell is missing, so they were green
without testing anything. They are not run by `playwright.config.js`. Port what is still useful into
`e2e/public` or `e2e/signed-in`, then delete this folder.
