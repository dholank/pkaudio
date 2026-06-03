import fs from "node:fs/promises";
import path from "node:path";
import { getCredentialForUpload, recordCredentialUse } from "@/lib/credentials/repository";
import type { CredentialStatus, CreatorType } from "@/lib/credentials/types";
import { ROBLOX_AUDIO_DESCRIPTION } from "@/lib/roblox/metadata";

const DEFAULT_ASSETS_BASE_URL = "https://apis.roblox.com/assets/v1";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const DEFAULT_POLL_ATTEMPTS = 30;
const DEFAULT_POLL_INTERVAL_MS = 2500;

type RobloxJson = Record<string, unknown>;

type RobloxCredentialForUpload = {
  id: string;
  name: string;
  creatorType: CreatorType;
  creatorId: string;
  apiKey: string;
};

export type RobloxUploadInput = {
  credentialId: string;
  filePath: string;
  displayName: string;
  description?: string;
  diagnostics?: {
    outputDurationSec?: number | null;
    outputSizeBytes?: number | null;
    outputSampleRate?: number | null;
    outputChannels?: number | null;
  };
  onLog?: (message: string) => Promise<void> | void;
};

export type RobloxOperationAuditResult = {
  assetId: string | null;
  operationId: string | null;
  operationPath: string | null;
  status: "pending" | "done" | "failed" | "unknown";
  errorCode: string | null;
  errorMessage: string | null;
  rawOperation: unknown;
};

export type RobloxModerationAuditResult = {
  assetId: string;
  state: "reviewing" | "approved" | "rejected" | "unknown" | "failed";
  raw: unknown;
  errorMessage: string | null;
};

export type RobloxUploadResult = {
  assetId: string;
  operationId: string | null;
  operationPath: string | null;
  operationStatus: RobloxOperationAuditResult["status"];
  rawOperation: unknown;
};

export class RobloxUploadError extends Error {
  status: number | null;
  code: string | null;
  credentialStatus: CredentialStatus;

  constructor(message: string, options: { status?: number | null; code?: string | null; credentialStatus?: CredentialStatus } = {}) {
    super(message);
    this.name = "RobloxUploadError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.credentialStatus = options.credentialStatus ?? "failed";
  }
}

function getAssetsBaseUrl() {
  return (process.env.PKAUDIO_ROBLOX_ASSETS_BASE_URL ?? DEFAULT_ASSETS_BASE_URL).replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asObject(value: unknown): RobloxJson | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RobloxJson) : null;
}

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function sanitizeDisplayName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "PKAudio Upload").slice(0, 50);
}

function sanitizeDescription(value: string | undefined) {
  return (value ?? ROBLOX_AUDIO_DESCRIPTION).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function credentialStatusForHttp(status: number, body: RobloxJson | null): CredentialStatus {
  const bodyText = JSON.stringify(body ?? {}).toLowerCase();
  if (status === 401) return "failed";
  if (status === 403 || bodyText.includes("permission") || bodyText.includes("scope")) return "permission_issue";
  return "failed";
}

function classifyRobloxHttpError(status: number, body: RobloxJson | null, fallback: string) {
  const bodyText = JSON.stringify(body ?? {}).toLowerCase();
  const message = bodyErrorMessage(body) ?? fallback;
  if (status === 401) return "Roblox API key is invalid or expired.";
  if (status === 403) return `Roblox API key lacks permission for this creator/resource, Assets API scope, or allowed IPs. For group upload, create/configure the key under the target group or grant this exact group resource access with assets:write/assets:read. Also check API key IP restrictions. Roblox said: ${message}`;
  if (status === 404) return `Roblox API endpoint/resource was not found. ${message}`;
  if (status === 409) return `Roblox rejected the asset request due to a conflict. ${message}`;
  if (status === 413) return "Roblox rejected the upload because the audio file is too large.";
  if (status === 415) return "Roblox rejected the upload content type. Expected an OGG audio file.";
  if (status === 422 || status === 400) return `Roblox rejected the asset metadata or file. ${message}`;
  if (status === 429 || bodyText.includes("quota") || bodyText.includes("rate limit")) return `Roblox rate limit or upload quota reached. ${message}`;
  if (status >= 500) return `Roblox service error ${status}. Try again later. ${message}`;
  return `Roblox API ${status}: ${message}`;
}

function bodyErrorMessage(body: RobloxJson | null) {
  if (!body) return null;

  const message = asString(body.message) ?? asString(body.errorMessage);
  if (message) return message;

  const error = body.error;
  if (typeof error === "string") return error;

  const errorObject = asObject(error);
  if (errorObject) {
    return asString(errorObject.message) ?? asString(errorObject.details) ?? asString(errorObject.code);
  }

  const errors = Array.isArray(body.errors) ? body.errors : null;
  if (errors?.length) {
    const first = asObject(errors[0]);
    return first ? asString(first.message) ?? asString(first.code) : asString(errors[0]);
  }

  return null;
}

function bodyErrorCode(body: RobloxJson | null) {
  if (!body) return null;
  const direct = asString(body.code) ?? asString(body.errorCode);
  if (direct) return direct;

  const errorObject = asObject(body.error);
  return errorObject ? asString(errorObject.code) : null;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;

  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }

  const objectBody = asObject(body);
  if (!response.ok) {
    const message = classifyRobloxHttpError(response.status, objectBody, response.statusText || "Roblox request failed.");
    throw new RobloxUploadError(message, {
      status: response.status,
      code: bodyErrorCode(objectBody),
      credentialStatus: credentialStatusForHttp(response.status, objectBody),
    });
  }

  return body;
}

function extractOperationReference(value: unknown) {
  const body = asObject(value);
  if (!body) return null;

  const direct =
    asString(body.operationId) ??
    asString(body.operation_id) ??
    asString(body.id) ??
    asString(body.path) ??
    asString(body.name);

  if (direct) return direct;

  const operation = asObject(body.operation);
  return operation ? asString(operation.path) ?? asString(operation.name) ?? asString(operation.id) : null;
}

function extractOperationId(reference: string | null) {
  if (!reference) return null;
  const match = reference.match(/operations\/([^/?#]+)/i);
  return match?.[1] ?? reference;
}

function operationUrlFromReference(reference: string | null) {
  const baseUrl = getAssetsBaseUrl();
  if (!reference) return null;
  if (/^https?:\/\//i.test(reference)) return reference;

  const operationId = extractOperationId(reference);
  if (!operationId) return null;
  return `${baseUrl}/operations/${encodeURIComponent(operationId)}`;
}

function extractAssetId(value: unknown): string | null {
  const body = asObject(value);
  if (!body) return null;

  const direct = asString(body.assetId) ?? asString(body.asset_id);
  if (direct) return direct;

  const response = asObject(body.response);
  if (response) {
    const responseDirect = asString(response.assetId) ?? asString(response.asset_id) ?? asString(response.id);
    if (responseDirect) return responseDirect;

    const asset = asObject(response.asset);
    const assetId = asset ? asString(asset.assetId) ?? asString(asset.asset_id) ?? asString(asset.id) : null;
    if (assetId) return assetId;
  }

  const result = asObject(body.result);
  if (result) {
    const resultAssetId = asString(result.assetId) ?? asString(result.asset_id) ?? asString(result.id);
    if (resultAssetId) return resultAssetId;
  }

  return null;
}

function operationIsDone(value: unknown) {
  const body = asObject(value);
  return typeof body?.done === "boolean" ? body.done : false;
}

function normalizeModerationState(value: unknown): RobloxModerationAuditResult["state"] {
  const raw = asString(value)?.toLowerCase().replace(/[\s_-]+/g, "");
  if (!raw) return "unknown";
  if (raw === "reviewing" || raw === "reviewpending" || raw === "pendingreview" || raw === "inreview") return "reviewing";
  if (raw === "approved" || raw === "reviewapproved") return "approved";
  if (raw === "rejected" || raw === "moderated" || raw === "blocked") return "rejected";
  return "unknown";
}

function operationError(value: unknown) {
  const body = asObject(value);
  if (!body) return null;
  const error = asObject(body.error);
  if (!error) return null;

  return {
    code: asString(error.code),
    message: asString(error.message) ?? JSON.stringify(error),
  };
}

async function validateAudioFile(filePath: string) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new RobloxUploadError("Output path is not a file.");
  if (stat.size > MAX_AUDIO_BYTES) {
    throw new RobloxUploadError(`Roblox audio upload limit is 20 MB; output is ${(stat.size / 1024 / 1024).toFixed(2)} MB.`);
  }
  return stat;
}

function validateUploadPreflight(input: RobloxUploadInput, statSize: number) {
  const diagnostics = input.diagnostics;
  const errors: string[] = [];

  if (diagnostics?.outputDurationSec !== null && diagnostics?.outputDurationSec !== undefined && diagnostics.outputDurationSec > 420) {
    errors.push(`duration ${diagnostics.outputDurationSec.toFixed(2)}s exceeds Roblox 7 minute limit`);
  }
  const sizeBytes = diagnostics?.outputSizeBytes ?? statSize;
  if (sizeBytes > MAX_AUDIO_BYTES) errors.push(`file size ${(sizeBytes / 1024 / 1024).toFixed(2)} MB exceeds Roblox 20 MB upload limit`);
  if (diagnostics?.outputSampleRate !== null && diagnostics?.outputSampleRate !== undefined && diagnostics.outputSampleRate !== 44100) {
    errors.push(`sample rate ${diagnostics.outputSampleRate} Hz is not 44100 Hz`);
  }
  if (diagnostics?.outputChannels !== null && diagnostics?.outputChannels !== undefined && diagnostics.outputChannels !== 2) {
    errors.push(`audio has ${diagnostics.outputChannels} channel(s), expected stereo`);
  }

  if (errors.length) {
    throw new RobloxUploadError(`Roblox upload preflight failed: ${errors.join("; ")}.`, { credentialStatus: "active" });
  }
}

function creatorPayload(creatorType: CreatorType, creatorId: string) {
  return creatorType === "group" ? { groupId: creatorId } : { userId: creatorId };
}

async function createAssetOperation(credential: RobloxCredentialForUpload, filePath: string, displayName: string, description: string) {
  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  const request = {
    assetType: "Audio",
    displayName: sanitizeDisplayName(displayName),
    description: sanitizeDescription(description),
    creationContext: {
      creator: creatorPayload(credential.creatorType, credential.creatorId),
    },
  };

  form.append("request", JSON.stringify(request));
  form.append("fileContent", new Blob([new Uint8Array(fileBuffer)], { type: "audio/ogg" }), path.basename(filePath));

  const response = await fetch(`${getAssetsBaseUrl()}/assets`, {
    method: "POST",
    headers: {
      "x-api-key": credential.apiKey,
    },
    body: form,
  });

  return parseResponse(response);
}

async function getOperationWithCredential(reference: string, apiKey: string): Promise<RobloxOperationAuditResult> {
  const url = operationUrlFromReference(reference);
  if (!url) throw new RobloxUploadError("Roblox did not return a valid operation URL.");

  const response = await fetch(url, {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });
  const body = await parseResponse(response);
  const assetId = extractAssetId(body);
  const error = operationError(body);
  const operationId = extractOperationId(reference);

  if (error) {
    return {
      assetId,
      operationId,
      operationPath: reference,
      status: "failed",
      errorCode: error.code,
      errorMessage: error.message,
      rawOperation: body,
    };
  }

  if (assetId) {
    return {
      assetId,
      operationId,
      operationPath: reference,
      status: "done",
      errorCode: null,
      errorMessage: null,
      rawOperation: body,
    };
  }

  if (operationIsDone(body)) {
    return {
      assetId: null,
      operationId,
      operationPath: reference,
      status: "unknown",
      errorCode: null,
      errorMessage: "Operation is done but no asset ID was returned.",
      rawOperation: body,
    };
  }

  return {
    assetId: null,
    operationId,
    operationPath: reference,
    status: "pending",
    errorCode: null,
    errorMessage: null,
    rawOperation: body,
  };
}

async function pollOperationWithCredential(reference: string, apiKey: string, onLog?: RobloxUploadInput["onLog"]) {
  const attempts = Number(process.env.PKAUDIO_ROBLOX_POLL_ATTEMPTS ?? DEFAULT_POLL_ATTEMPTS);
  const intervalMs = Number(process.env.PKAUDIO_ROBLOX_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);

  let lastAudit: RobloxOperationAuditResult | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(intervalMs);
    await onLog?.(`Polling Roblox operation (${attempt}/${attempts}).`);

    const audit = await getOperationWithCredential(reference, apiKey);
    lastAudit = audit;

    if (audit.assetId) return audit;

    if (audit.status === "failed") {
      throw new RobloxUploadError(`Roblox operation failed: ${audit.errorMessage ?? "Unknown operation error."}`, {
        code: audit.errorCode,
        credentialStatus: audit.errorMessage?.toLowerCase().includes("permission") ? "permission_issue" : "failed",
      });
    }

    if (audit.status === "unknown") {
      throw new RobloxUploadError(audit.errorMessage ?? "Roblox operation completed without returning an asset ID.", { credentialStatus: "failed" });
    }
  }

  throw new RobloxUploadError(`Roblox operation timed out before returning an asset ID. Last response: ${JSON.stringify(lastAudit?.rawOperation ?? null)}`);
}

export function renderAssetName(pattern: string, values: { title: string | null; jobId: string; platform: string }) {
  const fallback = values.title ?? `PKAudio ${values.jobId.slice(0, 8)}`;
  return sanitizeDisplayName(
    (pattern || "{title}")
      .replaceAll("{title}", fallback)
      .replaceAll("{id}", values.jobId.slice(0, 8))
      .replaceAll("{platform}", values.platform),
  );
}

export async function testRobloxCredentialAccess(input: { credentialId: string }) {
  const credential = await getCredentialForUpload(input.credentialId);
  if (!credential) {
    throw new RobloxUploadError("Selected Roblox credential was not found.", { credentialStatus: "failed" });
  }

  try {
    const response = await fetch(`${getAssetsBaseUrl()}/operations/pkaudio-credential-test`, {
      method: "GET",
      headers: { "x-api-key": credential.apiKey },
    });

    // A missing/invalid fake operation still proves the key reached the Assets API auth layer.
    // Roblox may return either 404 for a missing operation or 400 InvalidArgument for an invalid OperationId.
    if (response.status === 404 || response.status === 400) {
      const text = await response.clone().text();
      if (response.status === 404 || text.toLowerCase().includes("invalid operationid") || text.toLowerCase().includes("invalid operation id")) {
        await recordCredentialUse(credential.id, "active");
        return { status: "active" as CredentialStatus, message: "Roblox API key reached the Assets API successfully." };
      }
    }

    await parseResponse(response);
    await recordCredentialUse(credential.id, "active");
    return { status: "active" as CredentialStatus, message: "Roblox API key is accepted by the Assets API." };
  } catch (error) {
    const status = error instanceof RobloxUploadError ? error.credentialStatus : "failed";
    await recordCredentialUse(credential.id, status);
    throw error;
  }
}

export async function auditRobloxOperation(input: { credentialId: string; operationReference: string }): Promise<RobloxOperationAuditResult> {
  const credential = await getCredentialForUpload(input.credentialId);
  if (!credential) {
    throw new RobloxUploadError("Selected Roblox credential was not found.", { credentialStatus: "failed" });
  }

  try {
    const audit = await getOperationWithCredential(input.operationReference, credential.apiKey);
    await recordCredentialUse(credential.id, "active");
    return audit;
  } catch (error) {
    await recordCredentialUse(credential.id, error instanceof RobloxUploadError ? error.credentialStatus : "failed");
    throw error;
  }
}

export async function auditRobloxAssetModeration(input: { credentialId: string; assetId: string }): Promise<RobloxModerationAuditResult> {
  const credential = await getCredentialForUpload(input.credentialId);
  if (!credential) {
    throw new RobloxUploadError("Selected Roblox credential was not found.", { credentialStatus: "failed" });
  }

  try {
    const url = `${getAssetsBaseUrl()}/assets/${encodeURIComponent(input.assetId)}?readMask=moderationResult`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": credential.apiKey },
    });
    const body = await parseResponse(response);
    const objectBody = asObject(body);
    const moderationResult = asObject(objectBody?.moderationResult);
    const state = normalizeModerationState(moderationResult?.moderationState);
    await recordCredentialUse(credential.id, "active");
    return {
      assetId: input.assetId,
      state,
      raw: body,
      errorMessage: state === "unknown" ? "Roblox did not return moderationResult.moderationState." : null,
    };
  } catch (error) {
    await recordCredentialUse(credential.id, error instanceof RobloxUploadError ? error.credentialStatus : "failed");
    if (error instanceof RobloxUploadError) throw error;
    throw new RobloxUploadError(error instanceof Error ? error.message : "Failed to check Roblox moderation status.");
  }
}

export async function uploadRobloxAudioAsset(input: RobloxUploadInput): Promise<RobloxUploadResult> {
  const credential = await getCredentialForUpload(input.credentialId);
  if (!credential) {
    throw new RobloxUploadError("Selected Roblox credential was not found.", { credentialStatus: "failed" });
  }

  const stat = await validateAudioFile(input.filePath);
  validateUploadPreflight(input, stat.size);
  await input.onLog?.(`Uploading OGG to Roblox as ${credential.creatorType} ${credential.creatorId}.`);

  try {
    const operation = await createAssetOperation(credential, input.filePath, input.displayName, input.description ?? ROBLOX_AUDIO_DESCRIPTION);
    const directAssetId = extractAssetId(operation);
    const operationReference = extractOperationReference(operation);
    const operationId = extractOperationId(operationReference);

    if (directAssetId) {
      await recordCredentialUse(credential.id, "active");
      return { assetId: directAssetId, operationId, operationPath: operationReference, operationStatus: "done", rawOperation: operation };
    }

    if (!operationReference) {
      throw new RobloxUploadError(`Roblox create asset response did not include an operation reference: ${JSON.stringify(operation)}`);
    }

    await input.onLog?.(`Roblox create asset operation: ${operationId ?? operationReference}.`);
    const poll = await pollOperationWithCredential(operationReference, credential.apiKey, input.onLog);
    await recordCredentialUse(credential.id, "active");

    if (!poll.assetId) {
      throw new RobloxUploadError("Roblox operation polling returned without an asset ID.", { credentialStatus: "failed" });
    }

    return {
      assetId: poll.assetId,
      operationId,
      operationPath: operationReference,
      operationStatus: poll.status,
      rawOperation: poll.rawOperation,
    };
  } catch (error) {
    await recordCredentialUse(credential.id, error instanceof RobloxUploadError ? error.credentialStatus : "failed");
    throw error;
  }
}
