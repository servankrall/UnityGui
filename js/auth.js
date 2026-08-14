/* =========================================================================
   UnityGUI — Authentication (Google Sign-In)
   -------------------------------------------------------------------------
   Real Google Sign-In via Google Identity Services (GIS) when a Client ID is
   configured in js/config.js. Falls back to a clearly-marked DEMO login when
   no Client ID is set, so the app is testable before you finish setup.

   NOTE ON SECURITY: this is a client-side gate. The Google ID token is decoded
   in the browser (not signature-verified on a server), so login and credits
   are enforced only in the browser — fine for a personal/demo build. For
   tamper-proof access you need a backend that verifies the token server-side.
   ========================================================================= */
(function (global) {
  "use strict";
  const CFG = global.UnityGUIConfig || {};
  const LS_USER = "unitygui.user";
  const listeners = [];

  function base64UrlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = str.length % 4; if (pad) str += "=".repeat(4 - pad);
    const bin = atob(str);
    // UTF-8 safe
    try {
      return decodeURIComponent(bin.split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    } catch { return bin; }
  }
  function decodeJwt(token) {
    try { return JSON.parse(base64UrlDecode(token.split(".")[1])); }
    catch { return null; }
  }

  function isOwner(email) {
    return !!email && CFG.OWNER_EMAIL &&
      email.trim().toLowerCase() === String(CFG.OWNER_EMAIL).trim().toLowerCase();
  }

  function saveUser(u) { try { localStorage.setItem(LS_USER, JSON.stringify(u)); } catch {} }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(LS_USER)) || null; } catch { return null; }
  }
  function isLoggedIn() { return !!getUser(); }

  function setUserFromProfile(p) {
    const user = {
      email: p.email,
      name: p.name || (p.email ? p.email.split("@")[0] : "Player"),
      picture: p.picture || "",
      owner: isOwner(p.email),
      loginAt: Date.now(),
      mode: p.mode || "google",
    };
    saveUser(user);
    listeners.forEach(fn => { try { fn(user); } catch {} });
    return user;
  }

  function handleCredentialResponse(response) {
    const payload = decodeJwt(response.credential);
    if (!payload || !payload.email) { console.warn("Google sign-in: no email in token"); return; }
    setUserFromProfile({ email: payload.email, name: payload.name, picture: payload.picture, mode: "google" });
  }

  function logout() {
    try { localStorage.removeItem(LS_USER); } catch {}
    try { if (global.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch {}
    listeners.forEach(fn => { try { fn(null); } catch {} });
  }

  function onChange(fn) { listeners.push(fn); return fn; }

  /* ---- Render the Google button (or demo fallback) into a container ----- */
  function renderButton(container, opts = {}) {
    const clientId = CFG.GOOGLE_CLIENT_ID;
    if (clientId) {
      waitForGoogle(() => {
        try {
          google.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse, auto_select: false });
          google.accounts.id.renderButton(container, {
            theme: "filled_blue", size: "large", shape: "pill", text: "signin_with",
            logo_alignment: "left", width: opts.width || 280,
          });
          if (opts.oneTap) google.accounts.id.prompt();
        } catch (e) { showConfigError(container, "Google Sign-In could not start: " + e.message); }
      }, () => showConfigError(container, "Couldn't load Google Sign-In. Check your connection and that this origin is an Authorized JavaScript origin."));
    } else {
      renderDemo(container);
    }
  }

  function renderDemo(container) {
    container.innerHTML = `
      <div class="demo-login">
        <p class="demo-note">⚠ Demo mode — no Google Client ID set in <code>js/config.js</code>.</p>
        <input type="email" id="demo-email" class="demo-input" placeholder="you@gmail.com" autocomplete="email" />
        <button class="btn btn-primary btn-block" id="demo-go">Continue</button>
        <p class="demo-hint">Sign in with <b>${(CFG.OWNER_EMAIL || "the owner email")}</b> to get unlimited credits.</p>
      </div>`;
    const go = () => {
      const email = (container.querySelector("#demo-email").value || "").trim();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { container.querySelector("#demo-email").focus(); return; }
      setUserFromProfile({ email, name: email.split("@")[0], mode: "demo" });
    };
    container.querySelector("#demo-go").addEventListener("click", go);
    container.querySelector("#demo-email").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  }

  function showConfigError(container, msg) {
    container.innerHTML = `<p class="demo-note">${msg}</p>`;
    const d = document.createElement("div"); renderDemo(d); container.appendChild(d.firstElementChild);
  }

  function waitForGoogle(ready, fail) {
    let tries = 0;
    (function poll() {
      if (global.google && google.accounts && google.accounts.id) return ready();
      if (++tries > 100) return fail && fail();       // ~10s
      setTimeout(poll, 100);
    })();
  }

  global.UnityGUIAuth = {
    isLoggedIn, getUser, logout, onChange, renderButton, isOwner,
    // exposed for testing
    _setUserFromProfile: setUserFromProfile,
  };
})(typeof window !== "undefined" ? window : this);
