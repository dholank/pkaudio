import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandOptions = {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
};

export async function runCommand(command: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer ?? 1024 * 1024,
      env: process.env,
    });

    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    if (error instanceof Error) {
      const withOutput = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer; code?: string | number; signal?: string };
      const stdout = Buffer.isBuffer(withOutput.stdout) ? withOutput.stdout.toString("utf8") : (withOutput.stdout ?? "");
      const stderr = Buffer.isBuffer(withOutput.stderr) ? withOutput.stderr.toString("utf8") : (withOutput.stderr ?? "");
      const details = [stderr, stdout].filter(Boolean).join("\n").trim();
      const suffix = details ? `\n${details}` : "";
      throw new Error(`${command} ${args.join(" ")} failed: ${error.message}${suffix}`);
    }

    throw error;
  }
}
