import "server-only";

// Server-only wrapper around bunny.net's Storage API (plain PUT-over-HTTP,
// no SDK needed). Never call from client code — BUNNY_STORAGE_API_KEY must
// stay server-side.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      throw new Error(`Unsupported image type: ${mime}`);
  }
}

function buildImageKey(prefix: string, mime: string): string {
  return `${prefix}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
}

export function buildWordImageKey(mime: string): string {
  return buildImageKey("words", mime);
}

export function buildDeckCoverImageKey(mime: string): string {
  return buildImageKey("decks", mime);
}

export async function uploadImage(file: File, key: string): Promise<void> {
  const endpoint =
    process.env.BUNNY_STORAGE_ENDPOINT || "https://storage.bunnycdn.com";
  const zone = requireEnv("BUNNY_STORAGE_ZONE");
  const apiKey = requireEnv("BUNNY_STORAGE_API_KEY");
  const buffer = Buffer.from(await file.arrayBuffer());

  const res = await fetch(`${endpoint}/${zone}/${key}`, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: buffer,
  });

  if (!res.ok) {
    throw new Error(`Bunny upload failed (${res.status}): ${await res.text()}`);
  }
}

export function imageUrl(imageKey: string): string {
  return `https://${requireEnv("BUNNY_PULL_ZONE_HOST")}/${imageKey}`;
}
