/**
 * 002 Phase 5 (US3): Widget list editor with drag-and-drop reorder and delete.
 *
 * Uses @hello-pangea/dnd for reordering. Each item shows type icon, name,
 * grip handle, configure button, and delete button.
 *
 * FR-003: Reorder widgets via drag-and-drop.
 * FR-004: Delete widgets with confirmation.
 */

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Settings, Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/button.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog.js';
import type { WidgetDraft } from '../../state/useEditMode.js';
import { widgetRegistry } from './registry.js';
import { Badge } from '../ui/badge.js';
import {
  INTRINSIC_PUBLIC_WIDGET_TYPES,
  visibilityLabel,
} from '../../state/widgetVisibility.js';

interface WidgetListEditorProps {
  widgets: WidgetDraft[];
  onReorder: (orderedDraftIds: string[]) => void;
  onDelete: (draftId: string) => void;
  onConfigure: (draftId: string) => void;
  onAddWidget: () => void;
}

export function WidgetListEditor({
  widgets,
  onReorder,
  onDelete,
  onConfigure,
  onAddWidget,
}: WidgetListEditorProps) {
  const [deleteTarget, setDeleteTarget] = useState<WidgetDraft | null>(null);

  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const ordered = [...widgets];
    const [moved] = ordered.splice(result.source.index, 1);
    ordered.splice(result.destination.index, 0, moved!);
    onReorder(ordered.map((w) => w.draftId));
  }

  function confirmDelete() {
    if (deleteTarget) {
      onDelete(deleteTarget.draftId);
      setDeleteTarget(null);
    }
  }

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-6">
        <p className="text-sm text-muted-foreground">No widgets — add one from the picker</p>
        <Button variant="outline" size="sm" onClick={onAddWidget}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Widget
        </Button>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widget-list">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
              {widgets.map((widget, index) => {
                const def = widgetRegistry.get(widget.type);
                const Icon = def?.icon;
                const name = def?.displayName ?? widget.type;

                return (
                  <Draggable key={widget.draftId} draggableId={widget.draftId} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                          snapshot.isDragging
                            ? 'border-primary bg-accent shadow-md'
                            : 'border-border bg-background'
                        }`}
                      >
                        <div
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab text-muted-foreground hover:text-foreground"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1 truncate text-sm">{name}</span>
                        {INTRINSIC_PUBLIC_WIDGET_TYPES.has(widget.type) ? (
                          <Badge variant="info" className="hidden sm:inline-flex">Public</Badge>
                        ) : widget.publicVisibility !== 'hidden' ? (
                          <Badge variant="warning" className="hidden sm:inline-flex">
                            {visibilityLabel(widget.publicVisibility)}
                          </Badge>
                        ) : null}
                        {def?.ConfigFormComponent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="no-drag h-7 w-7"
                            onClick={() => onConfigure(widget.draftId)}
                            aria-label={`Configure ${name}`}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="no-drag h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(widget)}
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-2">
        <Button variant="outline" size="sm" onClick={onAddWidget}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Widget
        </Button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Widget</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this {widgetRegistry.get(deleteTarget?.type ?? '')?.displayName ?? 'widget'}? This action will take effect when you save the layout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
