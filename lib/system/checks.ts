import { runCommand } from "@/lib/system/command";

export type BinaryCheck = {
  name: string;
  command: string;
  ok: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

async function which(command: string) {
  try {
    const { stdout } = await runCommand("bash", ["-lc", `command -v ${command}`], { timeout: 5000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function version(command: string, args: string[]) {
  try {
    const { stdout } = await runCommand(command, args, { timeout: 7000 });
    return stdout.split(/\r?\n/)[0]?.trim() || null;
  } catch (error) {
    return error instanceof Error ? error.message : "Failed to read version.";
  }
}

export async function checkBinary(name: string, command: string, args: string[]): Promise<BinaryCheck> {
  const path = await which(command);
  if (!path) {
    return { name, command, ok: false, path: null, version: null, error: `${command} not found in PATH.` };
  }

  const versionText = await version(command, args);
  return { name, command, ok: true, path, version: versionText, error: null };
}

export async function getSystemChecks() {
  const [ffmpeg, ffprobe, ytdlp] = await Promise.all([
    checkBinary("ffmpeg", "ffmpeg", ["-version"]),
    checkBinary("ffprobe", "ffprobe", ["-version"]),
    checkBinary("yt-dlp", "yt-dlp", ["--version"]),
  ]);

  return { ffmpeg, ffprobe, ytdlp };
}
