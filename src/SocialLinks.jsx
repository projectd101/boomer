import { useState } from "react";
import { updateHolderSocials, isValidSocialHandle } from "./supabaseClient";

export default function SocialLinks({
  titleId,
  instagram,
  tiktok,
  isOwner,
  onUpdated,
}) {
  const [editing, setEditing] = useState(false);
  const [igInput, setIgInput] = useState(instagram || "");
  const [ttInput, setTtInput] = useState(tiktok || "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const hasAny = Boolean(instagram || tiktok);

  const handleSave = async () => {
    setFormError("");

    if (!isValidSocialHandle(igInput) || !isValidSocialHandle(ttInput)) {
      setFormError(
        "Handles can only contain letters, numbers, dots, and underscores (max 30 characters)."
      );
      return;
    }

    setSaving(true);

    try {
      const updated = await updateHolderSocials(titleId, {
        instagram: igInput.trim(),
        tiktok: ttInput.trim(),
      });

      onUpdated?.(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to update socials", err);
      setFormError("Couldn't save -- please check the handles and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="social-links social-links-editing">
        <label className="social-input-label">
          Instagram handle
          <input
            className="social-input"
            value={igInput}
            onChange={(e) => setIgInput(e.target.value)}
            placeholder="yourhandle"
            maxLength={30}
          />
        </label>

        <label className="social-input-label">
          TikTok handle
          <input
            className="social-input"
            value={ttInput}
            onChange={(e) => setTtInput(e.target.value)}
            placeholder="yourhandle"
            maxLength={30}
          />
        </label>

        {formError && <p className="social-error">{formError}</p>}

        <div className="social-edit-actions">
          <button
            className="social-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            className="social-cancel-btn"
            onClick={() => {
              setEditing(false);
              setFormError("");
              setIgInput(instagram || "");
              setTtInput(tiktok || "");
            }}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="social-links">
      {instagram && (
        <a
          className="social-pill"
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="social-icon instagram-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
            </svg>
          </span>

          @{instagram}
        </a>
      )}

      {tiktok && (
        <a
          className="social-pill"
          href={`https://tiktok.com/@${tiktok}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="social-icon tiktok-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-1.86V15.5a6.5 6.5 0 1 1-5.62-6.44v3.27a3.27 3.27 0 1 0 2.35 3.13V2h3.28a4.84 4.84 0 0 0 3.76 1.8v2.89Z" />
            </svg>
          </span>

          @{tiktok}
        </a>
      )}

      {!hasAny && !isOwner && (
        <span className="social-empty">No socials linked</span>
      )}

      {isOwner && (
        <button
          className="social-edit-btn"
          onClick={() => setEditing(true)}
          title="Add or edit your social links"
        >
          {hasAny ? "Edit" : "+ Add socials"}
        </button>
      )}
    </div>
  );
}