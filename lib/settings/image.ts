/**
 * Turning a file someone picked into something a Firestore document can hold.
 *
 * The whole job is getting under the 1MiB document ceiling without handing the
 * user a size limit to obey: phone cameras produce 4MB JPEGs, and "your photo
 * is too big" is not an answer anybody can act on. So the image is re-drawn at
 * a sane size and re-encoded until it fits, and only a genuinely hopeless one
 * is refused.
 */

export type ImageBudget = {
  /** Longest edge, in CSS pixels, after downscaling. */
  maxSide: number;
  /** Starting JPEG quality; lowered on retry if the result is still too big. */
  quality: number;
  /** The ceiling the encoded data URL has to come in under. */
  maxBytes: number;
};

export class ImageError extends Error {}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** A data URL's real size — base64 costs about a third on top of the bytes. */
function byteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("That file couldn't be read as an image."));
    };
    image.src = url;
  });
}

/**
 * Downscales and re-encodes a picked file into a data URL inside `budget`.
 *
 * Always re-encoded as JPEG, including PNGs: a screenshot saved as PNG can be
 * several megabytes of losslessly-stored photo, and keeping the format would
 * mean refusing files that compress perfectly well. Transparency is flattened
 * onto white, which is the only sensible thing to do for an avatar or a
 * backdrop anyway.
 */
export async function toStoredImage(
  file: File,
  budget: ImageBudget,
): Promise<string> {
  if (!ACCEPTED.includes(file.type)) {
    throw new ImageError("Pick a JPEG, PNG, WebP or GIF.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, budget.maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageError("This browser can't process that image.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  // Step the quality down rather than guessing once: how well a photo
  // compresses depends on the photo, and a flat guess either wastes bytes on
  // an easy one or fails on a busy one.
  for (const quality of [budget.quality, 0.65, 0.5, 0.4, 0.3]) {
    const encoded = canvas.toDataURL("image/jpeg", quality);
    if (byteLength(encoded) <= budget.maxBytes) return encoded;
  }

  throw new ImageError(
    "That image is too detailed to store. Try a smaller or simpler one.",
  );
}
