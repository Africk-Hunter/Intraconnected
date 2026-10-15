// Write-side format switches. The app has not shipped, so no client exists
// that cannot read the new formats; both are on. Old formats stay readable.
// If a format ever needs rolling back, flip it here: readers accept both.
export const WRITE_ENC2 = true;
export const WRITE_PASSWORD_WRAP_V3 = true;
