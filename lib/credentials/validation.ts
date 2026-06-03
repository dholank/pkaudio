import { z } from "zod";

export const credentialCreateSchema = z.object({
  name: z.string().trim().min(1, "Display name is required.").max(80),
  creatorType: z.enum(["user", "group"]),
  creatorId: z.string().trim().regex(/^\d+$/, "Creator ID must be numeric."),
  apiKey: z.string().trim().min(8, "API key is too short."),
});

export const credentialUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  creatorType: z.enum(["user", "group"]).optional(),
  creatorId: z.string().trim().regex(/^\d+$/, "Creator ID must be numeric.").optional(),
  apiKey: z.string().trim().min(8).optional(),
});

export type CredentialCreateInput = z.infer<typeof credentialCreateSchema>;
export type CredentialUpdateInput = z.infer<typeof credentialUpdateSchema>;
