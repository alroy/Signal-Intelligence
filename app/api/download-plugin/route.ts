import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "docs",
    "pm-signal-intelligence-plugin.zip"
  );
  const fileBuffer = await readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        'attachment; filename="pm-signal-intelligence-plugin.zip"',
      "Content-Length": String(fileBuffer.byteLength),
    },
  });
}
