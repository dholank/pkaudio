import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/jobs/types";

const statusVariant: Record<JobStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  queued: "secondary",
  downloading: "cyan",
  probing: "cyan",
  converting: "default",
  converted: "warning",
  uploading: "cyan",
  done: "success",
  failed: "destructive",
  cancelled: "outline",
};

const statusLabel: Record<JobStatus, string> = {
  queued: "Queued",
  downloading: "Downloading",
  probing: "Probing",
  converting: "Converting",
  converted: "Converted",
  uploading: "Uploading",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}
