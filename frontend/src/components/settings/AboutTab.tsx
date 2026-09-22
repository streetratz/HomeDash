/**
 * About tab — build info, server info, and changelog.
 * Visible to all authenticated users (read-only).
 */

import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ExternalLink,
  GitCommitHorizontal,
  Calendar,
  Server,
  Clock,
  Tag,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient.js';
import {
  APP_VERSION,
  BUILD_DATE,
  GIT_COMMIT,
  COMMIT_URL,
  CHANGELOG,
  RELEASES_URL,
} from '../../lib/buildInfo.js';

interface SystemInfo {
  version: string;
  nodeVersion: string;
  environment: string;
  uptime: number;
  uptimeHuman: string;
}

function useSystemInfo() {
  return useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: () => apiClient.get<SystemInfo>('/api/system/info'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function BuildInfoSection() {
  const buildDate = new Date(BUILD_DATE);
  const formattedDate = buildDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Build Information
      </h3>
      <div className="divide-y divide-border rounded-lg border bg-card p-4">
        <InfoRow icon={Tag} label="Version">
          v{APP_VERSION}
        </InfoRow>
        <InfoRow icon={Calendar} label="Built">
          {formattedDate}
        </InfoRow>
        <InfoRow icon={GitCommitHorizontal} label="Commit">
          <a
            href={COMMIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
          >
            {GIT_COMMIT}
            <ExternalLink className="h-3 w-3" />
          </a>
        </InfoRow>
      </div>
    </div>
  );
}

function ServerInfoSection() {
  const { data, isLoading, isError } = useSystemInfo();

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Server
      </h3>
      <div className="divide-y divide-border rounded-lg border bg-card p-4">
        {isLoading && (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="py-2 text-sm text-destructive">Failed to load server info</p>
        )}
        {data && (
          <>
            <InfoRow icon={Clock} label="Uptime">
              {data.uptimeHuman}
            </InfoRow>
            <InfoRow icon={Server} label="Node.js">
              {data.nodeVersion}
            </InfoRow>
            <InfoRow icon={Server} label="Environment">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                {data.environment}
              </span>
            </InfoRow>
          </>
        )}
      </div>
    </div>
  );
}

function ChangelogSection() {
  if (!CHANGELOG) {
    return null;
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Changelog
      </h3>
      <div className="rounded-lg border bg-card p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{CHANGELOG}</ReactMarkdown>
        </div>
        <div className="mt-4 border-t pt-3">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            View full changelog on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function AboutTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
          🏠
        </div>
        <div>
          <h2 className="text-lg font-semibold">HomeDash</h2>
          <p className="text-sm text-muted-foreground">
            Customizable Home Lab Dashboard
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <BuildInfoSection />
        <ServerInfoSection />
      </div>

      <ChangelogSection />
    </div>
  );
}
