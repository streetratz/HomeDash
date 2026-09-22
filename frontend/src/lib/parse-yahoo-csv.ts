/**
 * 021-stocks-widget: Client-side Yahoo Finance CSV parser.
 * Parses the exported portfolio CSV format and extracts symbols + lot data.
 */

export interface ParsedLot {
  purchasePrice: number;
  quantity: number;
  tradeDate: string;
}

export interface ParsedTicker {
  symbol: string;
  lots: ParsedLot[];
}

export interface CsvParseResult {
  tickers: ParsedTicker[];
  errors: string[];
}

/**
 * Parse a Yahoo Finance portfolio CSV string into structured ticker/lot data.
 * Deduplicates symbols and aggregates lots per symbol.
 *
 * Expected CSV columns (order may vary):
 * Symbol, Current Price, Date, Time, Change, Open, High, Low, Volume,
 * Trade Date, Purchase Price, Quantity, Commission, ...
 */
export function parseYahooCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];
  const lines = csvContent.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return { tickers: [], errors: ['CSV file is empty or has no data rows'] };
  }

  // Parse header row
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const symbolIdx = header.indexOf('symbol');
  const priceIdx = header.indexOf('purchase_price');
  const qtyIdx = header.indexOf('quantity');
  const tradeDateIdx = header.indexOf('trade_date');

  if (symbolIdx === -1) {
    return { tickers: [], errors: ['Missing required "Symbol" column in CSV'] };
  }

  // Group lots by symbol
  const tickerMap = new Map<string, ParsedLot[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const symbol = cols[symbolIdx]?.trim().toUpperCase();

    if (!symbol) {
      errors.push(`Row ${i + 1}: missing symbol, skipped`);
      continue;
    }

    const purchasePrice = priceIdx >= 0 ? parseFloat(cols[priceIdx] || '0') : 0;
    const quantity = qtyIdx >= 0 ? parseFloat(cols[qtyIdx] || '0') : 0;
    const tradeDate = tradeDateIdx >= 0 ? (cols[tradeDateIdx] || '').trim() : '';

    // Only add as a lot if we have meaningful purchase data
    if (purchasePrice > 0 && quantity > 0) {
      const normalizedTradeDate = formatTradeDate(tradeDate);
      if (!normalizedTradeDate) {
        errors.push(
          `Row ${i + 1}: purchase data requires a valid Trade Date; imported ${symbol} without the lot`,
        );
        if (!tickerMap.has(symbol)) {
          tickerMap.set(symbol, []);
        }
        continue;
      }

      const lot: ParsedLot = {
        purchasePrice,
        quantity,
        tradeDate: normalizedTradeDate,
      };

      if (!tickerMap.has(symbol)) {
        tickerMap.set(symbol, []);
      }
      tickerMap.get(symbol)!.push(lot);
    } else {
      // Still track the symbol even without lot data
      if (!tickerMap.has(symbol)) {
        tickerMap.set(symbol, []);
      }
    }
  }

  const tickers: ParsedTicker[] = Array.from(tickerMap.entries()).map(([symbol, lots]) => ({
    symbol,
    lots,
  }));

  return { tickers, errors };
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Normalize trade date formats to ISO-like YYYY-MM-DD.
 * Yahoo uses YYYYMMDD or YYYY/MM/DD formats.
 */
function formatTradeDate(raw: string): string | null {
  const cleaned = raw.replace(/['"]/g, '').trim();
  if (!cleaned) return null;

  // YYYYMMDD format
  if (/^\d{8}$/.test(cleaned)) {
    return validIsoDate(
      `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`,
    );
  }

  // YYYY/MM/DD format
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
    return validIsoDate(cleaned.replace(/\//g, '-'));
  }

  return validIsoDate(cleaned);
}

function validIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    ? value
    : null;
}
