// T025: MarkdownConfigForm — multi-line textarea with character count and live preview

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '../ui/label.js';
import { Textarea } from '../ui/textarea.js';
import { Button } from '../ui/button.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { MarkdownConfig } from '../../state/dashboards.js';

const MAX_LENGTH = 50_000;

export function MarkdownConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as Partial<MarkdownConfig>;
  const content = cfg.content ?? '';
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="markdown-content">Markdown Content</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
        </div>
        <Textarea
          id="markdown-content"
          rows={10}
          maxLength={MAX_LENGTH}
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ ...cfg, content: e.target.value })}
          placeholder="Enter markdown content..."
        />
        <p className="text-xs text-muted-foreground text-right">
          {content.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      {showPreview && (
        <div className="border rounded-md p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {content || '*No content*'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
