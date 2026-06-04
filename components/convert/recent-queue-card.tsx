"use client";

import Link from "next/link";
import { History, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCard } from "@/components/queue/job-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { JobView } from "@/lib/jobs/types";

type RecentQueueCardProps = {
  jobs: JobView[];
  workerHint?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * Shared recent queue card for Convert and Auto Cut pages.
 * Shows last 5 jobs, with a link to full Queue page.
 */
export function RecentQueueCard({
  jobs,
  workerHint = "Run <span class=\"font-mono text-zinc-300\">npm run worker</span> to convert & upload.",
  emptyTitle = "No active jobs",
  emptyDescription = "Paste a YouTube or SoundCloud URL to start converting audio for Roblox.",
}: RecentQueueCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Recent Queue</CardTitle>
          <CardDescription>
            Jobs stored in SQLite. {workerHint}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild><Link href="/queue">View all</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length ? jobs.slice(0, 5).map((job) => (
          <JobCard key={job.id} job={job} compact />
        )) : (
          <EmptyState icon={ListMusic} title={emptyTitle} description={emptyDescription} />
        )}
      </CardContent>
    </Card>
  );
}
