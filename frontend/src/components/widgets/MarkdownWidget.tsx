// T024: MarkdownWidget display — renders markdown content via react-markdown
// with remark-gfm for GitHub Flavored Markdown support.

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WidgetDisplayProps } from './registry.js';
import type { MarkdownConfig } from '../../state/dashboards.js';

export function MarkdownWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<MarkdownConfig>;
  const content = config.content ?? '';

  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm" data-testid="markdown-widget-empty">
        No content configured
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none h-full overflow-y-auto p-2"
      data-testid="markdown-widget"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // RD-01: Links open in new tab
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
