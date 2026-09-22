# Widget Registry Contract: Single-Link Widget

**Feature**: 030-shortcuts-single-link
**Date**: 2025-07-17

## Contract: Widget Type Registration

All widget types in HomeDash must register via the `widgetRegistry` Map in `frontend/src/components/widgets/registry.tsx`. The contract is:

```typescript
interface WidgetTypeDefinition {
  type: string;                      // Unique type key (lowercase, snake_case)
  name: string;                      // Human-readable display name
  description: string;               // Brief description for widget picker
  icon: React.ComponentType;         // Icon component for the widget picker
  component: React.ComponentType<WidgetDisplayProps>;     // Render component
  configComponent: React.ComponentType<WidgetConfigFormProps>; // Config form
  defaultConfig: Record<string, unknown>;                  // Default config values
  minW?: number;                     // Minimum grid width (optional)
  minH?: number;                     // Minimum grid height (optional)
}
```

### Single-Link Registration

```typescript
widgetRegistry.set('single_link', {
  type: 'single_link',
  name: 'Single Link',
  description: 'A prominent single-link tile with icon and optional background',
  icon: LinkIcon,
  component: SingleLinkWidget,
  configComponent: SingleLinkConfigForm,
  defaultConfig: {
    url: '',
    label: '',
    iconKey: null,
    subtitle: null,
    background: null,
  },
  minW: 1,
  minH: 1,
});
```

### Display Component Props

```typescript
interface WidgetDisplayProps {
  widget: WidgetView;    // Contains id, type, config (JSON)
  editMode: boolean;     // Whether dashboard is in edit mode
}
```

The display component reads its typed config via:
```typescript
const config = widget.config as SingleLinkConfig;
```

### Config Form Props

```typescript
interface WidgetConfigFormProps {
  widget: WidgetView;                          // Current widget state
  config: Record<string, unknown>;             // Current config values
  onConfigChange: (config: Record<string, unknown>) => void;  // Update handler
}
```

## Contract: Link Opening Behaviour

All link-opening widgets MUST apply:
- `target="_blank"` — opens in new tab
- `rel="noopener noreferrer"` — security best practice (Constitution I: Secure-by-Default)

```html
<a
  href={config.url}
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
```

## Contract: Icon Resolution

Icons are resolved via the existing icon utility chain:
1. Check `isCdnIcon(iconKey)` → render via `cdnIconUrl(iconKey)`
2. Check Lucide icon map → render Lucide component
3. Fallback → render `Globe` icon

Single-Link uses the same `IconPicker` component already used by the Shortcuts widget config form.
