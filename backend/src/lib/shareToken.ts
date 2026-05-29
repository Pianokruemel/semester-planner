import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomGroup(length: number) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function generateShareToken(): string {
  return `${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

export async function generateUniqueShareToken(maxAttempts = 8): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = generateShareToken();
    const existing = await prisma.plan.findUnique({ where: { shareToken: token }, select: { id: true } });
    if (!existing) {
      return token;
    }
  }
  throw new Error("Konnte keinen eindeutigen Share-Token erzeugen.");
}
