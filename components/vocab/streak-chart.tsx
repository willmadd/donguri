"use client";

import { useState } from "react";
import type { DailyWordCount } from "@/lib/definitions";

function formatDayShort(dateStr: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

function formatDayFull(dateStr: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 30;
const PAD_BOTTOM = 28;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + INNER_HEIGHT;

type Point = { x: number; y: number };

// Catmull-Rom -> cubic Bezier, so the line reads as one smooth curve through
// every day's value rather than straight segments.
function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// A single magnitude series (words learned per day), so one hue end to end —
// no categorical palette to assign or validate, no legend box needed.
export function StreakChart({ data }: { data: DailyWordCount[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((day) => day.count));
  const n = data.length;

  const points: Point[] = data.map((day, i) => ({
    x: PAD_LEFT + (n === 1 ? INNER_WIDTH / 2 : (i * INNER_WIDTH) / (n - 1)),
    y: BASELINE_Y - (day.count / max) * INNER_HEIGHT,
  }));

  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x},${BASELINE_Y} L ${points[0].x},${BASELINE_Y} Z`
      : "";

  // Thin the day labels so they never collide: at most ~8 across the width.
  const labelStride = Math.max(1, Math.ceil(n / 8));
  const lastIndex = n - 1;

  const tooltipWidth = 96;
  const tooltipHeight = 36;

  return (
    <div className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
        Words learned this streak
      </h2>

      <div className="mt-4" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label="Words learned per day this streak"
        >
          {[0, 0.5, 1].map((fraction) => (
            <line
              key={fraction}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={PAD_TOP + INNER_HEIGHT * (1 - fraction)}
              y2={PAD_TOP + INNER_HEIGHT * (1 - fraction)}
              className="stroke-sumi/10"
              strokeWidth={1}
            />
          ))}

          {areaPath && <path d={areaPath} className="fill-ai/10" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              className="stroke-ai"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {hovered !== null && (
            <line
              x1={points[hovered].x}
              x2={points[hovered].x}
              y1={PAD_TOP}
              y2={BASELINE_Y}
              className="stroke-sumi/20"
              strokeWidth={1}
            />
          )}

          {points.map((point, i) => {
            const isLast = i === lastIndex;
            const isActive = hovered === i;
            return (
              <g key={data[i].date}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isActive || isLast ? 5 : 3}
                  className="fill-ai stroke-washi-soft"
                  strokeWidth={2}
                />
                {/* Bigger, invisible hit target for hover + keyboard focus */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={12}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${data[i].count} word${data[i].count === 1 ? "" : "s"} on ${formatDayFull(data[i].date)}`}
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered((current) => (current === i ? null : current))}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered((current) => (current === i ? null : current))}
                />
              </g>
            );
          })}

          {lastIndex >= 0 && (
            <text
              x={points[lastIndex].x}
              y={Math.max(points[lastIndex].y - 12, 12)}
              textAnchor="end"
              className="fill-sumi text-[11px] font-medium"
            >
              {data[lastIndex].count}
            </text>
          )}

          {data.map((day, i) =>
            i % labelStride === 0 || i === lastIndex ? (
              <text
                key={day.date}
                x={points[i].x}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-sumi-soft text-[10px]"
              >
                {formatDayShort(day.date)}
              </text>
            ) : null,
          )}

          {hovered !== null &&
            (() => {
              const point = points[hovered];
              const boxX = Math.min(
                Math.max(point.x - tooltipWidth / 2, PAD_LEFT),
                WIDTH - PAD_RIGHT - tooltipWidth,
              );
              const boxY = Math.max(point.y - tooltipHeight - 10, 2);
              const day = data[hovered];
              return (
                <g pointerEvents="none">
                  <rect
                    x={boxX}
                    y={boxY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={8}
                    className="fill-sumi"
                  />
                  <text
                    x={boxX + tooltipWidth / 2}
                    y={boxY + 15}
                    textAnchor="middle"
                    className="fill-washi text-[10px] font-medium"
                  >
                    {formatDayFull(day.date)}
                  </text>
                  <text
                    x={boxX + tooltipWidth / 2}
                    y={boxY + 28}
                    textAnchor="middle"
                    className="fill-washi text-[10px]"
                  >
                    {day.count} word{day.count === 1 ? "" : "s"}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>

      <table className="sr-only">
        <caption>Words learned per day this streak</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Words learned</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <td>{formatDayFull(day.date)}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
