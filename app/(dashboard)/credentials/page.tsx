import { CredentialsManager } from "@/components/credentials/credentials-manager";
import { listCredentials } from "@/lib/credentials/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CredentialsPage() {
  const credentials = await listCredentials();
  return <CredentialsManager initialCredentials={credentials} />;
}
