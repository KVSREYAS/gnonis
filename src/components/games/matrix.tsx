"use client";

import { cn } from "@/lib/utils";
import type { Matrix } from "@/lib/games/game-theory";

/** Payoff table. Row player's payoff in gold, column player's in green. */
export function PayoffMatrix({
  rows,
  cols,
  payoffs,
  selected,
  onCell,
  onRow,
  onCol,
  deadRows = [],
  deadCols = [],
  disabled,
}: {
  rows: string[];
  cols: string[];
  payoffs: Matrix;
  selected?: Set<string>;
  onCell?: (r: number, c: number) => void;
  onRow?: (r: number) => void;
  onCol?: (c: number) => void;
  deadRows?: number[];
  deadCols?: number[];
  disabled?: boolean;
}) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className="border-separate border-spacing-1 text-base">
        <thead>
          <tr>
            <th className="p-1 text-xs text-muted-foreground">You ↓ · Them →</th>
            {cols.map((c, j) => (
              <th key={j} className={cn("p-0", deadCols.includes(j) && "opacity-30")}>
                {onCol ? (
                  <button type="button" disabled={disabled || deadCols.includes(j)} onClick={() => onCol(j)} className="min-h-11 w-full rounded-md border-2 border-money/60 px-2 text-money-ink hover:border-money" data-testid={`col-${j}`}>
                    {c}
                  </button>
                ) : (
                  <span className="text-money-ink">{c}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payoffs.map((row, i) => (
            <tr key={i} className={cn(deadRows.includes(i) && "opacity-30")}>
              <th className="p-0 text-left">
                {onRow ? (
                  <button type="button" disabled={disabled || deadRows.includes(i)} onClick={() => onRow(i)} className="min-h-11 w-full rounded-md border-2 border-gold/60 px-2 text-gold-ink hover:border-gold" data-testid={`row-${i}`}>
                    {rows[i]}
                  </button>
                ) : (
                  <span className="pr-2 text-gold-ink">{rows[i]}</span>
                )}
              </th>
              {row.map((cell, j) => {
                const sel = selected?.has(`${i},${j}`);
                const dead = deadRows.includes(i) || deadCols.includes(j);
                return (
                  <td key={j} className={cn(dead && "opacity-30")}>
                    <button
                      type="button"
                      disabled={disabled || !onCell || dead}
                      onClick={() => onCell?.(i, j)}
                      aria-pressed={sel}
                      data-testid={`cell-${i}-${j}`}
                      className={cn("min-h-12 min-w-20 rounded-md border-2 bg-ink px-3 font-mono", sel ? "border-gold bg-gold/20" : "border-border", onCell && !disabled && "hover:border-gold")}
                    >
                      <span className="text-gold-ink">{cell[0]}</span>, <span className="text-money-ink">{cell[1]}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
