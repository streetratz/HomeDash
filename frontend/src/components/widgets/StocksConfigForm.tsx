/**
 * 021-stocks-widget: Configuration form for stock portfolio widget.
 * Manages groups, ticker search, CSV import, and display settings.
 */

import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Upload, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { generateUUID } from '../../lib/uuid.js';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { Switch } from '../ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';
import type { WidgetConfigFormProps } from './registry.js';
import { useStockSearch } from '../../hooks/useStocks.js';
import { parseYahooCsv } from '../../lib/parse-yahoo-csv.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockLot {
  purchasePrice: number;
  quantity: number;
  tradeDate: string;
}

export interface StockTicker {
  symbol: string;
  lots?: StockLot[];
}

export interface StockGroup {
  id: string;
  name: string;
  currency: string;
  tickers: StockTicker[];
  collapsed?: boolean;
  includeInTotal?: boolean;
  csvFilename?: string;
  lastImported?: string;
}

interface StocksConfig {
  groups: StockGroup[];
  displayCurrency: string;
  refreshInterval: number;
  displayMode: 'minimized' | 'compact' | 'expanded';
  showSparkline: boolean;
  reduceOffHours: boolean;
  hideZeroUnits: boolean;
}

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'NZD', 'CHF', 'HKD', 'SGD'];

export function isValidStockLot(lot: StockLot): boolean {
  if (!Number.isFinite(lot.purchasePrice) || lot.purchasePrice <= 0) return false;
  if (!Number.isFinite(lot.quantity) || lot.quantity <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lot.tradeDate)) return false;

  const parsed = new Date(`${lot.tradeDate}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(lot.tradeDate);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StocksConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg: StocksConfig = {
    groups: [],
    displayCurrency: 'AUD',
    refreshInterval: 300,
    displayMode: 'compact',
    showSparkline: false,
    reduceOffHours: true,
    hideZeroUnits: false,
    ...(config as Partial<StocksConfig>),
  };

  function update(patch: Partial<StocksConfig>) {
    onChange({ ...cfg, ...patch });
  }

  function updateGroup(groupId: string, patch: Partial<StockGroup>) {
    const groups = cfg.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    update({ groups });
  }

  function addGroup() {
    const id = generateUUID().slice(0, 8);
    const newGroup: StockGroup = {
      id,
      name: `Portfolio ${cfg.groups.length + 1}`,
      currency: cfg.displayCurrency,
      tickers: [],
      includeInTotal: true,
    };
    update({ groups: [...cfg.groups, newGroup] });
  }

  function removeGroup(groupId: string) {
    update({ groups: cfg.groups.filter((g) => g.id !== groupId) });
  }

  function addTicker(groupId: string, symbol: string) {
    const group = cfg.groups.find((g) => g.id === groupId);
    if (!group) return;
    if (group.tickers.some((t) => t.symbol === symbol)) return;
    updateGroup(groupId, { tickers: [...group.tickers, { symbol }] });
  }

  function removeTicker(groupId: string, symbol: string) {
    const group = cfg.groups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, { tickers: group.tickers.filter((t) => t.symbol !== symbol) });
  }

  function updateTicker(groupId: string, symbol: string, patch: Partial<StockTicker>) {
    const group = cfg.groups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, {
      tickers: group.tickers.map((ticker) =>
        ticker.symbol === symbol ? { ...ticker, ...patch } : ticker,
      ),
    });
  }

  return (
    <div className="space-y-6">
      {/* Display Settings */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Display Settings
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Display Currency</Label>
            <Select
              value={cfg.displayCurrency}
              onValueChange={(v) => update({ displayCurrency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Display Mode</Label>
            <Select
              value={cfg.displayMode}
              onValueChange={(v) => update({ displayMode: v as StocksConfig['displayMode'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimized">Minimized (totals only)</SelectItem>
                <SelectItem value="compact">Compact (group summaries)</SelectItem>
                <SelectItem value="expanded">Expanded (all tickers)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Refresh Interval</Label>
            <Select
              value={String(cfg.refreshInterval)}
              onValueChange={(v) => update({ refreshInterval: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">1 min</SelectItem>
                <SelectItem value="120">2 min</SelectItem>
                <SelectItem value="300">5 min (default)</SelectItem>
                <SelectItem value="600">10 min</SelectItem>
                <SelectItem value="900">15 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sparkline-toggle">Show Sparklines</Label>
          <Switch
            id="sparkline-toggle"
            checked={cfg.showSparkline}
            onCheckedChange={(v) => update({ showSparkline: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="offhours-toggle">Reduce polling off-hours</Label>
          <Switch
            id="offhours-toggle"
            checked={cfg.reduceOffHours}
            onCheckedChange={(v) => update({ reduceOffHours: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hide-zero-toggle">Hide zero-unit holdings</Label>
          <Switch
            id="hide-zero-toggle"
            checked={cfg.hideZeroUnits}
            onCheckedChange={(v) => update({ hideZeroUnits: v })}
          />
        </div>
      </section>

      {/* Portfolio Groups */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Portfolio Groups
          </h3>
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
          </Button>
        </div>

        {cfg.groups.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No groups configured. Add a group or import a CSV portfolio.
          </p>
        )}

        {cfg.groups.map((group) => (
          <GroupEditor
            key={group.id}
            group={group}
            onUpdate={(patch) => updateGroup(group.id, patch)}
            onRemove={() => removeGroup(group.id)}
            onAddTicker={(sym) => addTicker(group.id, sym)}
            onRemoveTicker={(sym) => removeTicker(group.id, sym)}
            onUpdateTicker={(symbol, patch) => updateTicker(group.id, symbol, patch)}
          />
        ))}
      </section>

      {/* CSV Import */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Import CSV
        </h3>
        <CsvImporter
          existingGroups={cfg.groups}
          displayCurrency={cfg.displayCurrency}
          onImport={(groups) => update({ groups })}
        />
      </section>
    </div>
  );
}

// ─── Group Editor ─────────────────────────────────────────────────────────────

interface GroupEditorProps {
  group: StockGroup;
  onUpdate: (patch: Partial<StockGroup>) => void;
  onRemove: () => void;
  onAddTicker: (symbol: string) => void;
  onRemoveTicker: (symbol: string) => void;
  onUpdateTicker: (symbol: string, patch: Partial<StockTicker>) => void;
}

function GroupEditor({
  group,
  onUpdate,
  onRemove,
  onAddTicker,
  onRemoveTicker,
  onUpdateTicker,
}: GroupEditorProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-h-10 items-center gap-2 text-left text-muted-foreground hover:text-foreground sm:min-h-0"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.name}`}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-xs font-medium sm:hidden">Portfolio details</span>
        </button>

        <Input
          value={group.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-10 flex-1 text-sm font-medium sm:h-8"
          aria-label="Portfolio group name"
        />

        <Select value={group.currency} onValueChange={(v) => onUpdate({ currency: v })}>
          <SelectTrigger className="h-10 w-full sm:h-8 sm:w-24" aria-label="Portfolio currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex min-h-10 items-center justify-between gap-2 sm:min-h-0 sm:justify-start">
          <Label htmlFor={`total-${group.id}`} className="text-xs">
            In Total
          </Label>
          <Switch
            id={`total-${group.id}`}
            checked={group.includeInTotal !== false}
            onCheckedChange={(v) => onUpdate({ includeInTotal: v })}
          />
        </div>

        <ConfirmDeleteButton
          label={`Remove ${group.name}`}
          title="Remove portfolio group?"
          description={`This removes ${group.name} and all of its tickers and lots.`}
          onConfirm={onRemove}
          className="self-end sm:self-auto"
        />
      </div>

      {expanded && (
        <div className="space-y-3 sm:pl-6">
          {/* Ticker list */}
          {group.tickers.length > 0 && (
            <div className="space-y-2">
              {group.tickers.map((t) => (
                <StockTickerEditor
                  key={t.symbol}
                  ticker={t}
                  currency={group.currency}
                  onUpdate={(patch) => onUpdateTicker(t.symbol, patch)}
                  onRemove={() => onRemoveTicker(t.symbol)}
                />
              ))}
            </div>
          )}

          {/* Ticker search */}
          <TickerSearch onSelect={onAddTicker} />

          {group.csvFilename && (
            <p className="text-xs text-muted-foreground">
              Imported from: {group.csvFilename}
              {group.lastImported && ` (${new Date(group.lastImported).toLocaleDateString()})`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StockTickerEditor({
  ticker,
  currency,
  onUpdate,
  onRemove,
}: {
  ticker: StockTicker;
  currency: string;
  onUpdate: (patch: Partial<StockTicker>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lots = ticker.lots ?? [];
  const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);

  function updateLot(index: number, nextLot: StockLot) {
    onUpdate({ lots: lots.map((lot, lotIndex) => (lotIndex === index ? nextLot : lot)) });
  }

  function removeLot(index: number) {
    const nextLots = lots.filter((_, lotIndex) => lotIndex !== index);
    onUpdate({ lots: nextLots });
  }

  function addLot() {
    const tradeDate = new Date().toISOString().slice(0, 10);
    onUpdate({ lots: [...lots, { purchasePrice: 1, quantity: 1, tradeDate }] });
    setExpanded(true);
  }

  return (
    <div className="rounded-md border border-border/70 bg-muted/20">
      <div className="flex min-h-11 items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} holding details for ${ticker.symbol}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-mono text-sm font-semibold">{ticker.symbol}</span>
          <span className="truncate text-xs text-muted-foreground">
            {lots.length === 0
              ? 'Watchlist only'
              : `${totalQuantity.toLocaleString()} units · ${lots.length} ${lots.length === 1 ? 'lot' : 'lots'}`}
          </span>
        </button>
        <ConfirmDeleteButton
          label={`Remove ${ticker.symbol}`}
          title={`Remove ${ticker.symbol}?`}
          description={
            lots.length > 0
              ? `This removes ${ticker.symbol} and ${lots.length} saved ${lots.length === 1 ? 'lot' : 'lots'}.`
              : `This removes ${ticker.symbol} from the watchlist.`
          }
          onConfirm={onRemove}
        />
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-border/70 p-2">
          {lots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No holdings recorded. Quotes will still appear as a watchlist item.
            </p>
          ) : (
            lots.map((lot, index) => (
              <StockLotEditor
                key={`${ticker.symbol}-${lot.tradeDate}-${lot.purchasePrice}-${lot.quantity}-${index}`}
                idPrefix={`${ticker.symbol}-${index}`}
                lot={lot}
                currency={currency}
                onChange={(nextLot) => updateLot(index, nextLot)}
                onRemove={() => removeLot(index)}
              />
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addLot}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add lot
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfirmDeleteButton({
  label,
  title,
  description,
  onConfirm,
  className = '',
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
  className?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-10 w-10 shrink-0 text-destructive hover:text-destructive sm:h-8 sm:w-8 ${className}`}
          aria-label={label}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StockLotEditor({
  idPrefix,
  lot,
  currency,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  lot: StockLot;
  currency: string;
  onChange: (lot: StockLot) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(String(lot.quantity));
  const [purchasePrice, setPurchasePrice] = useState(String(lot.purchasePrice));
  const [tradeDate, setTradeDate] = useState(lot.tradeDate);
  const draft = {
    quantity: Number(quantity),
    purchasePrice: Number(purchasePrice),
    tradeDate,
  };
  const isValid = isValidStockLot(draft);

  function commit() {
    if (isValid) onChange(draft);
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded-md bg-background/35 p-2 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
      <div>
        <Label htmlFor={`${idPrefix}-quantity`} className="text-xs">
          Quantity
        </Label>
        <Input
          id={`${idPrefix}-quantity`}
          type="number"
          min="0.000001"
          step="any"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          onBlur={commit}
          aria-invalid={!isValid}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-price`} className="text-xs">
          Price ({currency})
        </Label>
        <Input
          id={`${idPrefix}-price`}
          type="number"
          min="0.000001"
          step="any"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(event) => setPurchasePrice(event.target.value)}
          onBlur={commit}
          aria-invalid={!isValid}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-date`} className="text-xs">
          Trade date
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={tradeDate}
          onChange={(event) => setTradeDate(event.target.value)}
          onBlur={commit}
          aria-invalid={!isValid}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 justify-self-end text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove lot"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {!isValid && (
        <p className="text-xs text-destructive sm:col-span-4">
          Enter a positive quantity, positive purchase price, and valid trade date.
        </p>
      )}
    </div>
  );
}

// ─── Ticker Search ────────────────────────────────────────────────────────────

function TickerSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value.trim()), 300);
  }, []);

  const { data, isFetching } = useStockSearch(debouncedQuery);
  const results = data?.results ?? [];

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search ticker..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="h-7 text-xs"
        />
        {isFetching && <span className="text-xs text-muted-foreground">...</span>}
      </div>

      {results.length > 0 && query.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => {
                onSelect(r.symbol);
                setQuery('');
                setDebouncedQuery('');
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
            >
              <span className="font-mono font-medium">{r.symbol}</span>
              <span className="text-muted-foreground truncate ml-2">{r.shortname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CSV Importer ─────────────────────────────────────────────────────────────

interface CsvImporterProps {
  existingGroups: StockGroup[];
  displayCurrency: string;
  onImport: (updatedGroups: StockGroup[]) => void;
}

function CsvImporter({ existingGroups, displayCurrency, onImport }: CsvImporterProps) {
  const [importName, setImportName] = useState('');
  const [importCurrency, setImportCurrency] = useState(displayCurrency);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const baseName = file.name.replace(/\.csv$/i, '');
      setPendingFile({ name: file.name, content });
      setImportName(baseName);
      setParseErrors([]);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleImport() {
    if (!pendingFile) return;

    const { tickers, errors } = parseYahooCsv(pendingFile.content);
    if (errors.length > 0) setParseErrors(errors);

    if (tickers.length === 0) {
      setParseErrors(['No valid tickers found in CSV']);
      return;
    }

    // Check if group with same name exists (update it)
    const existingIdx = existingGroups.findIndex(
      (g) => g.name.toLowerCase() === importName.toLowerCase(),
    );

    const groupData: StockGroup = {
      id: existingIdx >= 0 ? existingGroups[existingIdx]!.id : generateUUID().slice(0, 8),
      name: importName,
      currency: importCurrency,
      tickers: tickers.map((t) => ({
        symbol: t.symbol,
        ...(t.lots.length > 0 ? { lots: t.lots } : {}),
      })),
      includeInTotal: true,
      csvFilename: pendingFile.name,
      lastImported: new Date().toISOString(),
    };

    let updatedGroups: StockGroup[];
    if (existingIdx >= 0) {
      updatedGroups = [...existingGroups];
      updatedGroups[existingIdx] = groupData;
    } else {
      updatedGroups = [...existingGroups, groupData];
    }

    onImport(updatedGroups);
    setPendingFile(null);
    setImportName('');
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!pendingFile ? (
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" /> Select CSV File
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium">File: {pendingFile.name}</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Group Name</Label>
              <Input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Select value={importCurrency} onValueChange={setImportCurrency}>
                <SelectTrigger className="h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleImport}>
              Import
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingFile(null)}>
              Cancel
            </Button>
          </div>

          {parseErrors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5">
              {parseErrors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
