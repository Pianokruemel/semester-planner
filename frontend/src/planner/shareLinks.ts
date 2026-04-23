import { normalizeShareCode } from "./shareCrypto";

const shareCodeParam = "code";

export function readShareCodeFromHash(hash: string): string | null {
  const hashValue = hash.startsWith("#") ? hash.slice(1) : hash;

  if (!hashValue) {
    return null;
  }

  const params = new URLSearchParams(hashValue);
  const code = params.get(shareCodeParam);

  if (!code) {
    return null;
  }

  return normalizeShareCode(code);
}

export function extractShareCode(input: string): string {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error("Bitte einen Link oder Acht-Wort-Code eingeben.");
  }

  const inlineHashCode = readShareCodeFromHash(trimmedInput);
  if (inlineHashCode) {
    return inlineHashCode;
  }

  try {
    const parsedUrl = new URL(trimmedInput);
    const codeFromUrl = readShareCodeFromHash(parsedUrl.hash);

    if (codeFromUrl) {
      return codeFromUrl;
    }
  } catch {
    // Fall back to treating the input as the raw eight-word code.
  }

  return normalizeShareCode(trimmedInput);
}

export function buildShareUrl(code: string, currentUrl = window.location.href): string {
  const normalizedCode = normalizeShareCode(code);
  const shareUrl = new URL(currentUrl);
  const hashParams = new URLSearchParams();

  shareUrl.pathname = "/";
  shareUrl.search = "";
  hashParams.set(shareCodeParam, normalizedCode);
  shareUrl.hash = hashParams.toString();

  return shareUrl.toString();
}