import sharp from "sharp";

const THUMBNAIL_WIDTH = 150;
const THUMBNAIL_QUALITY = 60;

export async function generateThumbnail(base64Data: string): Promise<string> {
  const raw = base64Data.replace(/^data:[^;]+;base64,/, "");
  const inputBuffer = Buffer.from(raw, "base64");

  const outputBuffer = await sharp(inputBuffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH, { fit: "cover", position: "center" })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return `data:image/jpeg;base64,${outputBuffer.toString("base64")}`;
}
