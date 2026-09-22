/**
 * T010 (005): TodoAddInput — inline input for adding a new task.
 */

import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';

interface TodoAddInputProps {
  listId: string;
  onAdd: (listId: string, title: string) => void;
}

export function TodoAddInput({ listId, onAdd }: TodoAddInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) {
      onAdd(listId, value.trim());
      setValue('');
    }
    if (e.key === 'Escape') {
      setValue('');
      inputRef.current?.blur();
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center text-muted-foreground/40">
        <Plus className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        type="text"
        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 outline-none"
        placeholder="Add a task…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
