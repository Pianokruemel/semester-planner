import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

const locatorSchema = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const base64UrlSchema = z.string().min(16).max(512_000).regex(/^[A-Za-z0-9_-]+$/);

const createShareSchema = z.object({
  locator: locatorSchema,
  ciphertext: base64UrlSchema,
  nonce: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/),
  payload_version: z.string().trim().min(1).max(20),
  crypto_version: z.string().trim().min(1).max(64),
  parent_snapshot_id: z.string().uuid().nullable().optional()
});

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function applyRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    throw new HttpError(429, "Anfrage momentan nicht verfuegbar.");
  }

  existing.count += 1;
}

function rateLimitKey(kind: "create" | "fetch", ipAddress: string | undefined) {
  return `${kind}:${ipAddress ?? "unknown"}`;
}

function hashLocator(locator: string) {
  return createHash("sha256").update(locator).digest("hex");
}

function toEnvelope(snapshot: {
  id: string;
  ciphertext: string;
  nonce: string;
  payloadVersion: string;
  cryptoVersion: string;
  parentSnapshotId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}) {
  return {
    id: snapshot.id,
    ciphertext: snapshot.ciphertext,
    nonce: snapshot.nonce,
    payload_version: snapshot.payloadVersion,
    crypto_version: snapshot.cryptoVersion,
    parent_snapshot_id: snapshot.parentSnapshotId,
    created_at: snapshot.createdAt.toISOString(),
    expires_at: snapshot.expiresAt?.toISOString() ?? null
  };
}

export const sharesRouter = Router();

sharesRouter.post("/", async (req, res) => {
  applyRateLimit(rateLimitKey("create", req.ip), 20, 60_000);
  const payload = createShareSchema.parse(req.body);

  try {
    const snapshot = await prisma.shareSnapshot.create({
      data: {
        locatorHash: hashLocator(payload.locator),
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        payloadVersion: payload.payload_version,
        cryptoVersion: payload.crypto_version,
        parentSnapshotId: payload.parent_snapshot_id ?? null
      }
    });

    res.status(201).json(toEnvelope(snapshot));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Share snapshot konnte nicht erstellt werden.");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new HttpError(400, "Ungueltige Share-Metadaten.");
    }

    throw error;
  }
});

sharesRouter.get("/:locator", async (req, res) => {
  applyRateLimit(rateLimitKey("fetch", req.ip), 120, 60_000);
  const locator = locatorSchema.parse(req.params.locator);

  const snapshot = await prisma.shareSnapshot.findUnique({
    where: { locatorHash: hashLocator(locator) }
  });

  if (!snapshot) {
    throw new HttpError(404, "Share snapshot nicht gefunden.");
  }

  res.json(toEnvelope(snapshot));
});