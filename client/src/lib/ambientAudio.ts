/** Books is silent. On iPhone this keeps a playing Music PWA from being interrupted. */
export function claimAmbientAudioSession(
  session: { type?: string } | null | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { audioSession?: { type?: string } }).audioSession,
): string | undefined {
  if (!session) return undefined;
  session.type = "ambient";
  return session.type;
}
