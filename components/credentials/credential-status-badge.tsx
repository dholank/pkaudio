import { Badge } from "@/components/ui/badge";
import type { CredentialStatus } from "@/lib/credentials/types";

export function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "permission_issue") return <Badge variant="warning">Permission issue</Badge>;
  return <Badge variant="secondary">Untested</Badge>;
}
