/**
 * Phase R6: Create/Edit Dashboard Dialog.
 *
 * Used for both creating new dashboards and editing existing ones.
 * FR-020: Admin dashboard management with create/rename/delete.
 * Phase 2 (003): Background customization settings in edit mode.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { Separator } from './ui/separator.js';
import { BackgroundSettings } from './BackgroundSettings.js';
import type { DashboardListItem } from '../state/adminDashboards.js';

type Applicability = 'web' | 'mobile' | 'both';

export interface DashboardDialogSubmitData {
  name: string;
  applicability: Applicability;
  backgroundType?: 'solid' | 'image';
  backgroundColor?: string | null;
  backgroundAssetId?: string | null;
  backgroundDisplayMode?: 'fill' | 'stretch' | null;
}

interface DashboardDialogProps {
  /** If provided, dialog is in edit mode for this dashboard */
  dashboard?: DashboardListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DashboardDialogSubmitData) => void;
  isSubmitting?: boolean;
}

export function DashboardDialog({
  dashboard,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: DashboardDialogProps) {
  const isEdit = !!dashboard;
  const [name, setName] = useState('');
  const [applicability, setApplicability] = useState<Applicability>('both');

  // Background state (edit mode only)
  const [bgType, setBgType] = useState<'solid' | 'image'>('solid');
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [bgAssetId, setBgAssetId] = useState<string | null>(null);
  const [bgDisplayMode, setBgDisplayMode] = useState<'fill' | 'stretch' | null>(null);

  // Reset form when dialog opens/changes target
  const [prevId, setPrevId] = useState<string | null>(null);
  const targetId = dashboard?.id ?? (open ? '__create__' : null);
  if (targetId && targetId !== prevId) {
    setPrevId(targetId);
    setName(dashboard?.name ?? '');
    setApplicability(dashboard?.applicability ?? 'both');
    setBgType(dashboard?.backgroundType ?? 'solid');
    setBgColor(dashboard?.backgroundColor ?? null);
    setBgAssetId(dashboard?.backgroundAssetId ?? null);
    setBgDisplayMode(dashboard?.backgroundDisplayMode ?? null);
  }
  // Reset tracking when dialog closes
  if (!open && prevId !== null) {
    setPrevId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const data: DashboardDialogSubmitData = { name: trimmed, applicability };

    if (isEdit) {
      data.backgroundType = bgType;
      data.backgroundColor = bgColor;
      data.backgroundAssetId = bgAssetId;
      data.backgroundDisplayMode = bgDisplayMode;
    }

    onSubmit(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Dashboard' : 'Create Dashboard'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dash-name">Name</Label>
            <Input
              id="dash-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              placeholder="My Dashboard"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dash-applicability">Device Applicability</Label>
            <Select value={applicability} onValueChange={(v) => setApplicability(v as Applicability)}>
              <SelectTrigger id="dash-applicability">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (Web &amp; Mobile)</SelectItem>
                <SelectItem value="web">Web Only</SelectItem>
                <SelectItem value="mobile">Mobile Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEdit && (
            <>
              <Separator />
              <BackgroundSettings
                backgroundType={bgType}
                backgroundColor={bgColor}
                backgroundAssetId={bgAssetId}
                backgroundDisplayMode={bgDisplayMode}
                onUpdate={(fields) => {
                  setBgType(fields.backgroundType);
                  setBgColor(fields.backgroundColor);
                  setBgAssetId(fields.backgroundAssetId);
                  setBgDisplayMode(fields.backgroundDisplayMode);
                }}
              />
            </>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

