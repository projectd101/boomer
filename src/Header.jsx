import { NavLink, Link } from "react-router-dom";

// Shared site header, used on every route via Layout.jsx.
export default function Header({
  liveViewers,
  currentUser,
  avatarMenuOpen,
  setAvatarMenuOpen,
  handleSignIn,
  handleSignOut,
}) {
  return (
    <header className="header">
      <Link to="/" className="brand">
        <div className="brand-mark">B</div>
        <div className="brand-name">BOOMERS</div>
      </Link>

      <nav className="main-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Home
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          About
        </NavLink>
        <NavLink
          to="/contact"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Contact
        </NavLink>
        <NavLink
          to="/terms"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Terms &amp; Conditions
        </NavLink>
        <NavLink
          to="/privacy"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          Privacy Policy
        </NavLink>
      </nav>

      <div className="header-right">
        <div className="live-viewers">
          <span className="live-viewers-dot" />
          {liveViewers} live
        </div>

        {currentUser ? (
          <div className="avatar-wrap">
            <button
              className="avatar"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              aria-label="Account menu"
            >
              {currentUser.user_metadata?.avatar_url ? (
                <img
                  src={currentUser.user_metadata.avatar_url}
                  alt="Your avatar"
                  className="avatar-image"
                />
              ) : (
                currentUser.email?.[0]?.toUpperCase() || "A"
              )}
            </button>

            {avatarMenuOpen && (
              <div className="avatar-menu">
                <div className="avatar-menu-email">{currentUser.email}</div>

                <button className="avatar-menu-item" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="sign-in-button"
            onClick={handleSignIn}
            type="button"
          >
            SIGN IN
            <span>→</span>
          </button>
        )}
      </div>
    </header>
  );
}