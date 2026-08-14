/* =========================================================================
   UnityGUI — Configuration
   -------------------------------------------------------------------------
   >>> STEP 1: Paste your Google OAuth Client ID below (see README → "Google
       login setup"). It looks like:  123456789-abc123.apps.googleusercontent.com
   >>> STEP 2: In Google Cloud Console, add your site's origin as an
       "Authorized JavaScript origin", e.g.  http://localhost:8080
   ========================================================================= */
window.UnityGUIConfig = {
  // Leave empty ("") to run in DEMO login mode (no Google, easy to test).
  // Fill it in to require REAL Google Sign-In.
  GOOGLE_CLIENT_ID: "",

  // This account gets UNLIMITED credits. Everyone else gets the free quota.
  OWNER_EMAIL: "servankangal21@gmail.com",

  // Free credits for non-owner accounts.
  FREE_CREDITS: 25,
};
