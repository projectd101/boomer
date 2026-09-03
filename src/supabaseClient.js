import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ogfvgncirtkdtkfpvcdg.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZnZnbmNpcnRrZHRrZnB2Y2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMjU0MTksImV4cCI6MjEwMzYwMTQxOX0.37awqBjkwBIJEA2EHVkO_5nfiMGwjJa1eezo24q-3Qc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET = "title-images";

export function titlePath(titleId) {
  return `title-${titleId}/card.png`;
}

export async function uploadTitleImage(titleId, blob) {
  const path = titlePath(titleId);

  // Remove the old file first so the bucket never holds more than 8 files
  await supabase.storage.from(BUCKET).remove([path]);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function incrementAura(titleId) {
  const { data, error } = await supabase.rpc("increment_aura", {
    p_title_id: titleId,
  });
  if (error) throw error;
  return data;
}

// Handle-only pattern for Instagram/TikTok usernames -- letters, numbers,
// dots, underscores, 1-30 chars. This mirrors the CHECK constraints on
// titles.holder_instagram / titles.holder_tiktok in the database, so
// invalid input is rejected instantly client-side instead of round-
// tripping to the server first. The database constraint is the real
// security boundary; this is just fast, friendly feedback.
const SOCIAL_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export function isValidSocialHandle(value) {
  if (!value) return true; // empty/null is always allowed (clears the field)
  return SOCIAL_HANDLE_PATTERN.test(value);
}

// Updates the current holder's Instagram/TikTok handles for a title.
// Only ever stores the bare handle, never a full URL -- the UI always
// builds the actual profile link itself from a fixed template
// (https://instagram.com/<handle>, https://tiktok.com/@<handle>), so a
// malicious value can never become an arbitrary/clickable link, only a
// rejected write (client-side check here) or a rejected write at the
// database (CHECK constraint + ownership trigger, which is the real
// enforcement -- this function cannot bypass either of those).
export async function updateHolderSocials(titleId, { instagram, tiktok }) {
  if (!isValidSocialHandle(instagram)) {
    throw new Error("Invalid Instagram handle");
  }
  if (!isValidSocialHandle(tiktok)) {
    throw new Error("Invalid TikTok handle");
  }

  const { data, error } = await supabase
    .from("titles")
    .update({
      holder_instagram: instagram || null,
      holder_tiktok: tiktok || null,
    })
    .eq("id", titleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Fetches the public.users profile row for a given auth user id
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Checks whether the profile has the required fields filled in
export function isProfileComplete(profile) {
  return Boolean(
    profile &&
      profile.display_name &&
      profile.country &&
      profile.address &&
      profile.favourite_quote
  );
}

export async function upsertUserProfile(userId, fields) {
  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}
export async function uploadUserAvatar(userId, file) {
  if (!userId || !file) {
    throw new Error("User and image are required.");
  }

  const extension = file.name?.split(".").pop()?.toLowerCase() || "png";
  const path = `avatars/${userId}.${extension}`;

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  // Ignore "file not found" when removing the previous avatar.
  if (removeError && !removeError.message?.toLowerCase().includes("not found")) {
    console.warn("Couldn't remove previous avatar:", removeError);
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return `${data.publicUrl}?t=${Date.now()}`;
}