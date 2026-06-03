export type CredentialStatus = "untested" | "active" | "failed" | "permission_issue";

export type CreatorType = "user" | "group";

export type CredentialView = {
  id: string;
  name: string;
  creatorType: CreatorType;
  creatorId: string;
  keyPreview: string;
  status: CredentialStatus;
  lastUsedAt: string | null;
  testedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
