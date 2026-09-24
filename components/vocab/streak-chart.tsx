"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import type { DailyActivityCount } from "@/lib/definitions";
import { useTranslations } from "@/components/i18n/locale-provider";

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
const HEIGHT = 180;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 28;
const PAD_BOTTOM = 28;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + INNER_HEIGHT;

// 2px gap between touching marks — every segment of a stack, so neighbors
// read as distinct without drawing a border around them.
const SEGMENT_GAP = 2;
const BAR_RADIUS = 4;
const MAX_STREAK_DOTS = 14;

// Vocab and grammar deliberately share the blue hue family (both are core
// lesson content); reviews are red, matching the Review action card, and
// the daily challenge gets its own green. Because
// two series share a hue, identity leans on the legend + tooltip + sr-only
// table rather than color-matching alone — see the CVD separation check run
// against --chart-vocab/--chart-grammar/--chart-challenge before picking
// these colors.
// Tailwind's scanner needs each class spelled out as a literal somewhere in
// source — `` `fill-${colorClass}` `` would never be generated — so every
// variant a series needs (fill/bg/stroke) is listed here in full rather than
// built from a shared color token at render time.
const SERIES = [
  {
    key: "review",
    labelKey: "streak_chart.series_review",
    fallback: "Review",
    bgClass: "bg-chart-review",
    strokeClass: "stroke-chart-review",
  },
  {
    key: "grammar",
    labelKey: "streak_chart.series_grammar",
    fallback: "Grammar",
    bgClass: "bg-chart-grammar",
    strokeClass: "stroke-chart-grammar",
  },
  {
    key: "vocab",
    labelKey: "streak_chart.series_vocab",
    fallback: "Vocabulary",
    bgClass: "bg-chart-vocab",
    strokeClass: "stroke-chart-vocab",
  },
  {
    key: "challenge",
    labelKey: "streak_chart.series_challenge",
    fallback: "Daily challenge",
    bgClass: "bg-chart-challenge",
    strokeClass: "stroke-chart-challenge",
  },
] as const satisfies readonly {
  key: keyof Pick<DailyActivityCount, "vocab" | "grammar" | "review" | "challenge">;
  labelKey: string;
  fallback: string;
  bgClass: string;
  strokeClass: string;
}[];

// Rounded top corners only — the baseline and the seams between stacked
// segments stay square, so rounding never fights the 2px surface gap.
function roundedTopRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M ${x},${y} h ${width} v ${height} h ${-width} Z`;
  return [
    `M ${x},${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
    `H ${x + width - r}`,
    `Q ${x + width},${y} ${x + width},${y + r}`,
    `V ${y + height}`,
    `H ${x}`,
    `Z`,
  ].join(" ");
}

type Segment = {
  key: string;
  value: number;
  y: number;
  height: number;
  isTop: boolean;
};

// Stacks bottom-up from the baseline, skipping zero-value series entirely
// (so the 2px gap never appears twice in a row) and rounding only the top
// edge of whichever segment ends up on top.
function stackSegments(
  values: readonly { key: string; value: number }[],
  max: number,
): Segment[] {
  const present = values.filter((v) => v.value > 0);
  let cursor = BASELINE_Y;
  const segments: Segment[] = present.map((v, i) => {
    const rawHeight = (v.value / max) * INNER_HEIGHT;
    const gap = i === 0 ? 0 : SEGMENT_GAP;
    const height = Math.max(rawHeight - gap, 1);
    cursor -= gap;
    const y = cursor - height;
    cursor = y;
    return { key: v.key, value: v.value, y, height, isTop: false };
  });
  if (segments.length > 0) segments[segments.length - 1].isTop = true;
  return segments;
}

export function StreakChart({
  data,
  currentStreak,
  longestStreak,
  activeToday,
}: {
  data: DailyActivityCount[];
  currentStreak: number;
  longestStreak?: number;
  activeToday?: boolean;
}) {
  const t = useTranslations();
  const [hovered, setHovered] = useState<number | null>(null);

  const totals = data.map((day) => day.vocab + day.grammar + day.review + day.challenge);
  const max = Math.max(1, ...totals);
  const n = data.length;

  const slot = n === 0 ? INNER_WIDTH : INNER_WIDTH / n;
  const barWidth = Math.min(28, Math.max(6, slot * 0.5));

  const days = data.map((day, i) => {
    const x = PAD_LEFT + slot * (i + 0.5);
    const segments = stackSegments(
      SERIES.map((series) => ({ key: series.key, value: day[series.key] })),
      max,
    );
    const topY = segments.length > 0 ? segments[segments.length - 1].y : BASELINE_Y;
    return { day, x, segments, total: totals[i], topY };
  });

  // Thin the day labels so they never collide: at most ~8 across the width.
  const labelStride = Math.max(1, Math.ceil(n / 8));
  const lastIndex = n - 1;
  const streakDots = Math.min(currentStreak, MAX_STREAK_DOTS);

  const tooltipWidth = 128;
  const tooltipHeight = 20 + SERIES.length * 14 + 6;

  return (
    <div className="min-w-0 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
          {t("streak_chart.title", "Learning activity")}
        </h2>

        {currentStreak > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-sumi">
              <Flame className="h-4 w-4 fill-kin text-kin drop-shadow-[0_0_6px_var(--kin)]" />
              {t("streak_chart.day_streak", "{{count}} day streak", { count: currentStreak })}
            </div>
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: streakDots }, (_, i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-kin" />
              ))}
              {currentStreak > MAX_STREAK_DOTS && (
                <span className="ml-0.5 text-xs font-medium text-sumi-soft">
                  +{currentStreak - MAX_STREAK_DOTS}
                </span>
              )}
            </div>
            {Boolean(longestStreak) && longestStreak! > currentStreak && (
              <span className="text-xs text-sumi-soft">
                {t("streak_chart.best_streak", "Best: {{count}}", { count: longestStreak! })}
              </span>
            )}
          </div>
        )}
      </div>

      {currentStreak > 0 && activeToday === false && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-kin">
          <Flame className="h-3.5 w-3.5 shrink-0" />
          {t(
            "streak_chart.at_risk",
            "Learn or review today so you don't lose your {{count}}-day streak!",
            { count: currentStreak },
          )}
        </p>
      )}

      {/* Legend — the dependable identity channel for 4 series; never rely
          on color-matching the bars alone. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-1.5 text-xs text-sumi-soft">
            <span className={`h-2 w-2 rounded-sm ${series.bgClass}`} />
            {t(series.labelKey, series.fallback)}
          </div>
        ))}
      </div>

      <div className="mt-4" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={t("streak_chart.aria_label", "Vocabulary, grammar, reviews and daily challenges completed per day")}
        >
          <defs>
            {/* A subtle lighter-at-the-top wash per series — same hue and
                value as the flat fill, just enough lift to keep the bars
                from reading as flat cutouts. */}
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`color-mix(in oklab, var(--chart-${series.key}) 80%, white)`} />
                <stop offset="100%" stopColor={`var(--chart-${series.key})`} />
              </linearGradient>
            ))}
            <filter id="bar-shadow" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.14" />
            </filter>
          </defs>

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

          {/* A soft column wash behind today so it reads as "where you are"
              at a glance, without competing with the bars themselves. */}
          {n > 0 && (
            <rect
              x={days[lastIndex].x - slot / 2}
              y={PAD_TOP}
              width={slot}
              height={INNER_HEIGHT}
              rx={6}
              className="fill-kin/10"
            />
          )}

          {days.map(({ day, x, segments, total, topY }, i) => {
            const isActive = hovered === i;
            return (
              <g
                key={day.date}
                className={isActive ? "opacity-90" : undefined}
                filter={segments.length > 0 ? "url(#bar-shadow)" : undefined}
              >
                {segments.map((segment) => (
                  <path
                    key={segment.key}
                    d={
                      segment.isTop
                        ? roundedTopRectPath(x - barWidth / 2, segment.y, barWidth, segment.height, BAR_RADIUS)
                        : `M ${x - barWidth / 2},${segment.y} h ${barWidth} v ${segment.height} h ${-barWidth} Z`
                    }
                    fill={`url(#grad-${segment.key})`}
                  />
                ))}
                {segments.length === 0 && (
                  <rect
                    x={x - barWidth / 2}
                    y={BASELINE_Y - 2}
                    width={barWidth}
                    height={2}
                    rx={1}
                    className="fill-sumi/10"
                  />
                )}

                <text
                  x={x}
                  y={Math.max(topY - 8, 12)}
                  textAnchor="middle"
                  className="fill-sumi text-[11px] font-medium"
                >
                  {total}
                </text>

                {/* Full-column, invisible hit target for hover + keyboard focus */}
                <rect
                  x={x - slot / 2}
                  y={PAD_TOP}
                  width={slot}
                  height={INNER_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={t(
                    "streak_chart.day_summary",
                    "{{date}}: {{vocab}} vocabulary, {{grammar}} grammar, {{review}} reviewed, {{challenge}} daily challenge",
                    {
                      date: formatDayFull(day.date),
                      vocab: day.vocab,
                      grammar: day.grammar,
                      review: day.review,
                      challenge: day.challenge,
                    },
                  )}
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered((current) => (current === i ? null : current))}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered((current) => (current === i ? null : current))}
                />
              </g>
            );
          })}

          {data.map((day, i) =>
            i % labelStride === 0 || i === lastIndex ? (
              <text
                key={day.date}
                x={days[i].x}
                y={HEIGHT - 6}
                textAnchor="middle"
                className={
                  i === lastIndex ? "fill-sumi text-[10px] font-semibold" : "fill-sumi-soft text-[10px]"
                }
              >
                {i === lastIndex ? t("streak_chart.today", "Today") : formatDayShort(day.date)}
              </text>
            ) : null,
          )}

          {hovered !== null &&
            (() => {
              const { day, x, topY } = days[hovered];
              const boxX = Math.min(Math.max(x - tooltipWidth / 2, PAD_LEFT), WIDTH - PAD_RIGHT - tooltipWidth);
              const boxY = Math.max(topY - tooltipHeight - 10, 2);
              return (
                <g pointerEvents="none">
                  <rect x={boxX} y={boxY} width={tooltipWidth} height={tooltipHeight} rx={8} className="fill-sumi" />
                  <text x={boxX + 10} y={boxY + 15} className="fill-washi text-[10px] font-medium">
                    {formatDayFull(day.date)}
                  </text>
                  {SERIES.map((series, i) => (
                    <g key={series.key}>
                      <line
                        x1={boxX + 10}
                        x2={boxX + 18}
                        y1={boxY + 28 + i * 14}
                        y2={boxY + 28 + i * 14}
                        className={series.strokeClass}
                        strokeWidth={2}
                      />
                      <text x={boxX + 24} y={boxY + 31 + i * 14} className="fill-washi/80 text-[9px]">
                        {t(series.labelKey, series.fallback)}
                      </text>
                      <text x={boxX + tooltipWidth - 10} y={boxY + 31 + i * 14} textAnchor="end" className="fill-washi text-[10px] font-medium">
                        {day[series.key]}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}
        </svg>
      </div>

      <table className="sr-only">
        <caption>{t("streak_chart.aria_label", "Vocabulary, grammar, reviews and daily challenges completed per day")}</caption>
        <thead>
          <tr>
            <th>{t("streak_chart.table_date", "Date")}</th>
            {SERIES.map((series) => (
              <th key={series.key}>{t(series.labelKey, series.fallback)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <td>{formatDayFull(day.date)}</td>
              {SERIES.map((series) => (
                <td key={series.key}>{day[series.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
