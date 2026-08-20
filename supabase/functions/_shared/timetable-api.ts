import { z } from "npm:zod@4.1.5";

export type TimetableEntry = {
  readonly period: number;
  readonly subject: string;
  readonly originalSubject: string;
  readonly type: "lesson" | "change" | "new" | "event" | "merge";
  readonly memo: string;
};

const ChangeSchema = z.object({
  subject: z.string(),
  memo: z.string().optional().default(""),
  type: z.enum(["swap", "new"]).optional().default("swap"),
});

const EventSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  classes: z.array(z.string()),
  memo: z.string().optional().default(""),
});

const MergeSchema = z.object({
  weekday: z.string(),
  title: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  classes: z.array(z.string()),
  memo: z.string().optional().default(""),
});

export const PublicStateSchema = z.object({
  base: z.record(z.string(), z.record(z.string(), z.array(z.string()))).default(
    {},
  ),
  baseMerges: z.array(MergeSchema).default([]),
  specialSchedules: z.record(
    z.string(),
    z.record(z.string(), z.array(z.string())),
  ).default({}),
  changes: z.record(z.string(), ChangeSchema).default({}),
  events: z.array(EventSchema).default([]),
  notices: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      titleFontSize: z.number().optional(),
      detailFontSize: z.number().optional(),
    }),
  ).default([]),
});

export type PublicState = z.infer<typeof PublicStateSchema>;

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function weekdayForDate(date: string): string {
  const dayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[dayIndex - 1] ?? WEEKDAYS[0];
}

export function resolveTimetable(
  stateValue: unknown,
  date: string,
  className: string,
): readonly TimetableEntry[] {
  const state = PublicStateSchema.parse(stateValue);
  const weekday = weekdayForDate(date);
  const subjects = state.specialSchedules[date]?.[className] ??
    state.base[className]?.[weekday] ?? [];

  return PERIODS.map((period, periodIndex): TimetableEntry => {
    const originalSubject = subjects[periodIndex] ?? "";
    const event = state.events.find((item) =>
      item.date === date && item.classes.includes(className) &&
      period >= item.start && period <= item.end
    );
    if (event) {
      return {
        period,
        subject: event.title,
        originalSubject,
        type: "event",
        memo: event.memo,
      };
    }

    const change = state.changes[`${date}__${className}__${period}`];
    if (change) {
      return {
        period,
        subject: change.subject,
        originalSubject,
        type: change.type === "new" ? "new" : "change",
        memo: change.memo,
      };
    }

    const merge = state.baseMerges.find((item) =>
      item.weekday === weekday && item.classes.includes(className) &&
      period >= item.start && period <= item.end
    );
    if (merge) {
      return {
        period,
        subject: merge.title,
        originalSubject,
        type: "merge",
        memo: merge.memo,
      };
    }

    return {
      period,
      subject: originalSubject,
      originalSubject,
      type: "lesson",
      memo: "",
    };
  });
}
