import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  CreateShareEnvelopeRequest,
  PlannerSnapshot,
  ShareEnvelope,
  normalizePlannerSnapshot,
  plannerSnapshotVersion,
  shareCryptoVersion
} from "../api/types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const pbkdf2Salt = encoder.encode("semester-planner.share-snapshot.v1");
const wordCount = 8;
const wordSet = new Set(wordlist);

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveEncryptionKey(code: string): Promise<CryptoKey> {
  const normalizedCode = normalizeShareCode(code);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(normalizedCode), "PBKDF2", false, [
    "deriveKey"
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: pbkdf2Salt,
      iterations: 210_000
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export function generateShareCode(): string {
  const indices = new Uint32Array(wordCount);
  crypto.getRandomValues(indices);

  return Array.from(indices, (value) => wordlist[value % wordlist.length]).join(" ");
}

export function normalizeShareCode(rawCode: string): string {
  const words = rawCode
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (words.length !== wordCount) {
    throw new Error("Bitte genau acht Woerter eingeben.");
  }

  if (!words.every((word) => wordSet.has(word))) {
    throw new Error("Der Code enthaelt ungueltige Woerter.");
  }

  return words.join(" ");
}

export async function deriveLocator(code: string): Promise<string> {
  const normalizedCode = normalizeShareCode(code);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`locator:${normalizedCode}`));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function encryptPlannerSnapshot(
  snapshot: PlannerSnapshot,
  code: string,
  parentSnapshotId: string | null
): Promise<CreateShareEnvelopeRequest> {
  const normalizedSnapshot = normalizePlannerSnapshot(snapshot);
  const key = await deriveEncryptionKey(code);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    encoder.encode(JSON.stringify(normalizedSnapshot))
  );

  return {
    locator: await deriveLocator(code),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    nonce: bytesToBase64Url(nonce),
    payload_version: plannerSnapshotVersion,
    crypto_version: shareCryptoVersion,
    parent_snapshot_id: parentSnapshotId
  };
}

export async function decryptPlannerSnapshot(envelope: ShareEnvelope, code: string): Promise<PlannerSnapshot> {
  if (envelope.payload_version !== plannerSnapshotVersion) {
    throw new Error("Unbekannte Snapshot-Version.");
  }

  if (envelope.crypto_version !== shareCryptoVersion) {
    throw new Error("Unbekannte Verschluesselungsversion.");
  }

  try {
    const key = await deriveEncryptionKey(code);
    const nonce = base64UrlToBytes(envelope.nonce);
    const ciphertext = base64UrlToBytes(envelope.ciphertext);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      key,
      toArrayBuffer(ciphertext)
    );

    return normalizePlannerSnapshot(JSON.parse(decoder.decode(new Uint8Array(decrypted))));
  } catch {
    throw new Error("Code konnte nicht geöffnet werden.");
  }
}