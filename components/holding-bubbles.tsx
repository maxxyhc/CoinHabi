"use client";

import { useMemo } from "react";
import { formatPercent } from "@/lib/calculations";
import { tx } from "@/lib/i18n";
import type { EnrichedHolding, Locale } from "@/lib/types";

type PackedBubble = { holding: EnrichedHolding; x: number; y: number; r: number };

function packBubbles(holdings: EnrichedHolding[]): { bubbles: PackedBubble[]; width: number; height: number } {
  const sorted = holdings.filter((holding) => holding.valueUsd > 0).sort((a, b) => b.valueUsd - a.valueUsd);
  if (sorted.length === 0) return { bubbles: [], width: 340, height: 0 };
  const scale = 72 / Math.sqrt(sorted[0].valueUsd);
  const placed: PackedBubble[] = [];
  sorted.forEach((holding, index) => {
    const r = Math.max(27, Math.sqrt(holding.valueUsd) * scale);
    if (placed.length === 0) {
      placed.push({ holding, x: 0, y: 0, r });
      return;
    }
    for (let step = 1; step <= 600; step += 1) {
      const angle = index * 2.399963 + step * 0.35;
      const dist = step * 1.5;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist * 0.82;
      if (placed.every((other) => Math.hypot(other.x - x, other.y - y) >= other.r + r + 4)) {
        placed.push({ holding, x, y, r });
        return;
      }
    }
    placed.push({ holding, x: 0, y: 0, r });
  });
  const pad = 6;
  const minX = Math.min(...placed.map((p) => p.x - p.r)) - pad;
  const maxX = Math.max(...placed.map((p) => p.x + p.r)) + pad;
  const minY = Math.min(...placed.map((p) => p.y - p.r)) - pad;
  const maxY = Math.max(...placed.map((p) => p.y + p.r)) + pad;
  return {
    bubbles: placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })),
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function HoldingBubbles({
  holdings,
  locale,
  selectedId = null,
  onSelect,
}: {
  holdings: EnrichedHolding[];
  locale: Locale;
  selectedId?: string | null;
  onSelect: (holding: EnrichedHolding) => void;
}) {
  const { bubbles, width, height } = useMemo(() => packBubbles(holdings), [holdings]);
  if (bubbles.length === 0) {
    return <p className="py-10 text-center text-xs text-titanium">{tx(locale, "No holdings yet.")}</p>;
  }
  return (
    <svg className="mt-3 w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
      {bubbles.map(({ holding, x, y, r }) => {
        const day = holding.asset_type === "cash" ? undefined : holding.quote?.dayChangePercent;
        const toneVar = typeof day !== "number" ? "--titanium" : day >= 0 ? "--mint" : "--rose";
        const alpha = typeof day !== "number" ? 0.12 : 0.13 + (Math.min(Math.abs(day), 3) / 3) * 0.22;
        const label = holding.symbol.replace(/\..*$/, "").slice(0, 6);
        const symbolSize = Math.min(Math.max(10, r * 0.32), 19);
        const subSize = Math.max(8.5, symbolSize * 0.62);
        const selected = holding.id === selectedId;
        return (
          <g
            className="holding-bubble"
            key={holding.id}
            onClick={() => onSelect(holding)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(holding);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <title>{`${holding.symbol} · ${holding.allocationPercent.toFixed(1)}%`}</title>
            <circle
              cx={x}
              cy={y}
              r={r}
              strokeWidth={selected ? 3 : typeof day === "number" && Math.abs(day) >= 1.5 ? 2 : 1.25}
              style={{
                fill: `rgb(var(${toneVar}) / ${(selected ? Math.min(alpha + 0.1, 0.45) : alpha).toFixed(2)})`,
                stroke: `rgb(var(${toneVar}) / ${selected ? 1 : 0.8})`,
              }}
            />
            <text fontSize={symbolSize} fontWeight={700} style={{ fill: "rgb(var(--ink))" }} textAnchor="middle" x={x} y={y - subSize * 0.3}>
              {label}
            </text>
            <text fontSize={subSize} fontWeight={600} style={{ fill: `rgb(var(${toneVar}))` }} textAnchor="middle" x={x} y={y + subSize * 1.25}>
              {typeof day === "number" ? formatPercent(day) : `${holding.allocationPercent.toFixed(1)}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
