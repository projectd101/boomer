import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  getUserProfile,
  upsertUserProfile,
  uploadUserAvatar,
} from "./supabaseClient";
import { COUNTRY_OPTIONS } from "./countries";

// Shared site header, used on every route via Layout.jsx.
export default function Header({
  liveViewers,
  currentUser,
  avatarMenuOpen,
  setAvatarMenuOpen,
  handleSignIn,
  handleSignOut,
}) {
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [quote, setQuote] = useState("");

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const avatarFileRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!currentUser) {
        setProfile(null);
        setProfileOpen(false);
        return;
      }

      try {
        const data = await getUserProfile(currentUser.id);

        if (!active) return;

        setProfile(data);
        setDisplayName(data?.display_name || "");
        setCountry(data?.country || "");
        setAddress(data?.address || "");
        setQuote(data?.favourite_quote || "");
        setAvatarUrl(data?.avatar_url || null);
      } catch (err) {
        console.error("Couldn't load user profile:", err);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const openProfile = () => {
    setAvatarMenuOpen(false);
    setProfileError(null);
    setProfileOpen(true);
    setEditing(false);
  };

  const startEditing = () => {
    setProfileError(null);

    setDisplayName(profile?.display_name || "");
    setCountry(profile?.country || "");
    setAddress(profile?.address || "");
    setQuote(profile?.favourite_quote || "");

    setAvatarFile(null);
    setAvatarPreview(null);

    setEditing(true);
  };

  const cancelEditing = () => {
    setProfileError(null);
    setAvatarFile(null);
    setAvatarPreview(null);

    setDisplayName(profile?.display_name || "");
    setCountry(profile?.country || "");
    setAddress(profile?.address || "");
    setQuote(profile?.favourite_quote || "");

    setEditing(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }

    setProfileError(null);
    setAvatarFile(file);

    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (
      !displayName.trim() ||
      !country.trim() ||
      !address.trim() ||
      !quote.trim()
    ) {
      setProfileError("Please fill in every field.");
      return;
    }

    setSaving(true);
    setProfileError(null);

    try {
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        setAvatarUploading(true);

        finalAvatarUrl = await uploadUserAvatar(
          currentUser.id,
          avatarFile
        );

        setAvatarUploading(false);
      }

      const updated = await upsertUserProfile(currentUser.id, {
        display_name: displayName.trim(),
        country: country.trim(),
        address: address.trim(),
        favourite_quote: quote.trim(),
        avatar_url: finalAvatarUrl || null,
      });

      setProfile(updated);
      setAvatarUrl(updated.avatar_url || null);

      setAvatarFile(null);
      setAvatarPreview(null);
      setEditing(false);
    } catch (err) {
      console.error("Couldn't save profile:", err);
      setAvatarUploading(false);
      setProfileError(
        err.message || "Couldn't save your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCloseProfile = () => {
    if (saving) return;

    setProfileOpen(false);
    setEditing(false);
    setProfileError(null);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const profileImage =
    avatarPreview ||
    avatarUrl ||
    currentUser?.user_metadata?.avatar_url ||
    null;

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
  <img src="/logo.png" alt="Boomers" className="brand-logo" />
  <div className="brand-name">BOOMERS</div>
</Link>

        <nav className="main-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            About
          </NavLink>

          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            Contact
          </NavLink>

          <NavLink
            to="/terms"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            Terms &amp; Conditions
          </NavLink>

          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
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
                onClick={() =>
                  setAvatarMenuOpen((v) => !v)
                }
                aria-label="Account menu"
                type="button"
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Your avatar"
                    className="avatar-image"
                  />
                ) : (
                  currentUser.email?.[0]?.toUpperCase() || "A"
                )}
              </button>

              {avatarMenuOpen && (
                <div className="avatar-menu">
                  <div className="avatar-menu-email">
                    {profile?.display_name || currentUser.email}
                  </div>

                  <button
                    className="avatar-menu-item"
                    onClick={openProfile}
                    type="button"
                  >
                    My profile
                  </button>

                  <button
                    className="avatar-menu-item"
                    onClick={handleSignOut}
                    type="button"
                  >
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

      {profileOpen && (
        <div
          className="profile-modal-overlay"
          onClick={handleCloseProfile}
        >
          <div
            className="profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="profile-modal-close"
              onClick={handleCloseProfile}
              type="button"
              disabled={saving}
            >
              ×
            </button>

            <div className="profile-modal-header">
              <p className="profile-modal-eyebrow">
                YOUR BOOMERS IDENTITY
              </p>

              <h2>YOUR PROFILE</h2>

              <p>
                This is the identity attached to your bids.
              </p>
            </div>

            <form onSubmit={handleSave}>
              <div className="profile-avatar-editor">
                <div className="profile-avatar-large">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Your profile"
                    />
                  ) : (
                    currentUser.email?.[0]?.toUpperCase() || "A"
                  )}
                </div>

                {editing && (
                  <>
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: "none" }}
                    />

                    <button
                      type="button"
                      className="profile-avatar-change"
                      onClick={() =>
                        avatarFileRef.current?.click()
                      }
                    >
                      {avatarFile
                        ? "Change image"
                        : "Change image"}
                    </button>
                  </>
                )}
              </div>

              <div className="profile-email">
                {currentUser.email}
              </div>

              <div className="profile-fields">
                <label>
                  <span>NAME</span>
                  <input
                    className="profile-input"
                    value={displayName}
                    onChange={(e) =>
                      setDisplayName(e.target.value)
                    }
                    disabled={!editing || saving}
                    placeholder="Your name"
                  />
                </label>

                <label>
                  <span>COUNTRY</span>
                  <select
                    className="profile-input"
                    value={country}
                    onChange={(e) =>
                      setCountry(e.target.value)
                    }
                    disabled={!editing || saving}
                  >
                    <option value="" disabled>
                      Select your country
                    </option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>ADDRESS</span>
                  <input
                    className="profile-input"
                    value={address}
                    onChange={(e) =>
                      setAddress(e.target.value)
                    }
                    disabled={!editing || saving}
                    placeholder="City, region"
                  />
                </label>

                <label>
                  <span>FAVOURITE QUOTE</span>
                  <input
                    className="profile-input"
                    value={quote}
                    onChange={(e) =>
                      setQuote(e.target.value)
                    }
                    disabled={!editing || saving}
                    placeholder="Your favourite quote"
                  />
                </label>
              </div>

              {profileError && (
                <p className="profile-error">
                  {profileError}
                </p>
              )}

              {editing ? (
                <div className="profile-actions">
                  <button
                    type="button"
                    className="profile-secondary-btn"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-primary-btn"
                    disabled={saving}
                  >
                    {avatarUploading
                      ? "Uploading image..."
                      : saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="profile-primary-btn profile-full-btn"
                  onClick={startEditing}
                >
                  Edit profile
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}