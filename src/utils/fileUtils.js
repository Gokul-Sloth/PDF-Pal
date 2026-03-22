export async function isPDF(file) {
  if (!file) return false;
  try {
    const buf = await file.slice(0, 5).arrayBuffer();
    const bytes = new Uint8Array(buf);
    // PDF magic: %PDF-
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  } catch (err) {
    console.warn("Failed to read magic bytes for file:", file?.name, err);
    return false; // Safely reject unreadable files
  }
}

export function isFileTooLarge(file, maxMb = 200) {
  if (!file) return false;
  return file.size > maxMb * 1024 * 1024;
}
