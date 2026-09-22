/**
 * Phase 2 (003): Background customization settings component.
 *
 * Provides radio selection for background type (none / solid / image),
 * color picker + hex input for solid, file upload + display mode for image,
 * and a live preview panel.
 */

import { useState, useRef, useId, useMemo } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { ColorPicker } from './ui/color-picker.js';
import { apiClient } from '../lib/apiClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type BackgroundType = 'solid' | 'image';
type DisplayMode = 'fill' | 'stretch';

interface BackgroundFields {
  backgroundType: BackgroundType;
  backgroundColor: string | null;
  backgroundAssetId: string | null;
  backgroundDisplayMode: DisplayMode | null;
}

export interface BackgroundSettingsProps extends BackgroundFields {
  onUpdate: (fields: BackgroundFields) => void;
}

/** Which radio is selected — "none" is solid with null color */
type RadioValue = 'none' | 'solid' | 'image';

interface UploadedAssetResult {
  id: string;
  kind: string;
  url: string;
  contentType: string;
  byteSize: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function toRadioValue(fields: BackgroundFields): RadioValue {
  if (fields.backgroundType === 'image') return 'image';
  if (fields.backgroundType === 'solid' && fields.backgroundColor) return 'solid';
  return 'none';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BackgroundSettings({
  backgroundType,
  backgroundColor,
  backgroundAssetId,
  backgroundDisplayMode,
  onUpdate,
}: BackgroundSettingsProps) {
  const radioId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Track the URL returned from upload for preview
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  // Local hex text for the manual input
  const [hexText, setHexText] = useState(backgroundColor ?? '#1e293b');

  const selected = toRadioValue({ backgroundType, backgroundColor, backgroundAssetId, backgroundDisplayMode });

  // If we have an asset ID but no uploaded URL yet, build the expected URL pattern
  const previewImageUrl = useMemo(() => {
    if (uploadedUrl) return uploadedUrl;
    if (backgroundAssetId) return `/assets/data/uploads/backgrounds/${backgroundAssetId}`;
    return null;
  }, [uploadedUrl, backgroundAssetId]);

  // ── Radio change handler ──────────────────────────────────────────────────

  function handleRadioChange(value: RadioValue) {
    switch (value) {
      case 'none':
        onUpdate({
          backgroundType: 'solid',
          backgroundColor: null,
          backgroundAssetId: null,
          backgroundDisplayMode: null,
        });
        break;
      case 'solid':
        onUpdate({
          backgroundType: 'solid',
          backgroundColor: hexText && HEX_RE.test(hexText) ? hexText : '#1e293b',
          backgroundAssetId: null,
          backgroundDisplayMode: null,
        });
        break;
      case 'image':
        onUpdate({
          backgroundType: 'image',
          backgroundColor: null,
          backgroundAssetId,
          backgroundDisplayMode: backgroundDisplayMode ?? 'fill',
        });
        break;
    }
  }

  // ── Color handlers ────────────────────────────────────────────────────────

  function handleColorPickerChange(color: string) {
    setHexText(color);
    onUpdate({
      backgroundType: 'solid',
      backgroundColor: color,
      backgroundAssetId: null,
      backgroundDisplayMode: null,
    });
  }

  // ── Upload handler ────────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiClient.upload<UploadedAssetResult>(
        '/api/admin/assets/background',
        formData,
      );
      setUploadedUrl(result.url);
      onUpdate({
        backgroundType: 'image',
        backgroundColor: null,
        backgroundAssetId: result.id,
        backgroundDisplayMode: backgroundDisplayMode ?? 'fill',
      });
      toast.success('Background image uploaded');
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  function handleDisplayModeChange(mode: DisplayMode) {
    onUpdate({
      backgroundType: 'image',
      backgroundColor: null,
      backgroundAssetId,
      backgroundDisplayMode: mode,
    });
  }

  // ── Preview style ─────────────────────────────────────────────────────────

  const previewStyle = useMemo((): React.CSSProperties => {
    if (selected === 'solid' && backgroundColor) {
      return { backgroundColor };
    }
    if (selected === 'image' && previewImageUrl) {
      return {
        backgroundImage: `url(${previewImageUrl})`,
        backgroundSize: backgroundDisplayMode === 'stretch' ? '100% 100%' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return {};
  }, [selected, backgroundColor, previewImageUrl, backgroundDisplayMode]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Radio group */}
      <Label>Background Type</Label>
      <div className="flex gap-4">
        {(['none', 'solid', 'image'] as const).map((value) => {
          const label = value === 'none' ? 'None' : value === 'solid' ? 'Solid Color' : 'Image';
          const id = `${radioId}-${value}`;
          return (
            <label key={value} htmlFor={id} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                id={id}
                name={`${radioId}-bg-type`}
                checked={selected === value}
                onChange={() => handleRadioChange(value)}
                className="accent-primary"
              />
              {label}
            </label>
          );
        })}
      </div>

      {/* Solid color controls */}
      {selected === 'solid' && (
        <div className="flex items-center gap-3">
          <ColorPicker
            value={backgroundColor ?? '#1e293b'}
            onChange={handleColorPickerChange}
          />
          <span className="font-mono text-xs text-muted-foreground">{hexText}</span>
        </div>
      )}

      {/* Image controls */}
      {selected === 'image' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
                // Reset so re-selecting the same file triggers onChange
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload Image'}
            </Button>
            {backgroundAssetId && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                Image set
              </span>
            )}
          </div>

          {/* Thumbnail preview after upload */}
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Background preview"
              className="h-16 w-28 rounded border border-input object-cover"
            />
          )}

          {/* Display mode */}
          <div className="flex flex-col gap-1.5">
            <Label>Display Mode</Label>
            <div className="flex gap-4">
              {(['fill', 'stretch'] as const).map((mode) => {
                const label = mode === 'fill' ? 'Fill (cover)' : 'Stretch (100% 100%)';
                const id = `${radioId}-dm-${mode}`;
                return (
                  <label key={mode} htmlFor={id} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="radio"
                      id={id}
                      name={`${radioId}-display-mode`}
                      checked={(backgroundDisplayMode ?? 'fill') === mode}
                      onChange={() => handleDisplayModeChange(mode)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live preview */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div
          className="h-24 w-full rounded-md border border-input bg-muted/30"
          style={previewStyle}
        />
      </div>
    </div>
  );
}
