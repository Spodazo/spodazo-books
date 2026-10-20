/** Public path for the Rudolph book: https://books.spodazo.com/Rudolph */
export const RUDOLPH_SLUG = "Rudolph";

/** Previous public path, kept so old links redirect. */
export const RUDOLPH_LEGACY_SLUG = "Rudolph-The-Red-Nosed-Reindeer";

/** Permanent redirect target for the old Rudolph path, or null when the path is current. */
export function rudolphLegacyRedirect(pathname: string): string | null {
  const pathOnly = String(pathname || "").replace(/\/+$/, "") || "/";
  const lower = pathOnly.toLowerCase();
  if (lower === `/${RUDOLPH_LEGACY_SLUG.toLowerCase()}`) return `/${RUDOLPH_SLUG}`;
  if (lower === `/admin/edit/${RUDOLPH_LEGACY_SLUG.toLowerCase()}`) return `/admin/edit/${RUDOLPH_SLUG}`;
  return null;
}
