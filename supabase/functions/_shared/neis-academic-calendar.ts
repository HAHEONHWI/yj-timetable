import { z } from "npm:zod@4.1.5";

const resultSchema = z.object({
  CODE: z.string(),
  MESSAGE: z.string(),
});

const scheduleRowSchema = z.object({
  ATPT_OFCDC_SC_CODE: z.string(),
  SD_SCHUL_CODE: z.string(),
  AA_YMD: z.string().regex(/^\d{8}$/),
  EVENT_NM: z.string().trim().min(1),
  EVENT_CNTNT: z.string().nullish().transform((value) => value?.trim() ?? ""),
  ONE_GRADE_EVENT_YN: z.string(),
  TW_GRADE_EVENT_YN: z.string(),
  THREE_GRADE_EVENT_YN: z.string(),
  SBTR_DD_SC_NM: z.string().nullish().transform((value) => value?.trim() ?? ""),
  LOAD_DTM: z.string().regex(/^\d{8,}$/).nullish(),
});

const countSchema = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/).transform(Number)]);

const successResponseSchema = z.object({
  SchoolSchedule: z.tuple([
    z.object({
      head: z.tuple([
        z.object({ list_total_count: countSchema }),
        z.object({ RESULT: resultSchema }),
      ]),
    }),
    z.object({ row: z.array(scheduleRowSchema) }),
  ]),
});

const emptyResponseSchema = z.object({ RESULT: resultSchema });

export type NeisAcademicEvent = {
  readonly id: string;
  readonly source: "neis";
  readonly schoolCode: string;
  readonly date: string;
  readonly title: string;
  readonly content: string;
  readonly grades: readonly number[];
  readonly isSchoolDay: boolean;
  readonly sourceUpdatedAt: string;
};

export type NeisSchedulePage = {
  readonly totalCount: number;
  readonly events: readonly NeisAcademicEvent[];
};

export class NeisResponseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`NEIS ${code}: ${message}`);
    this.name = "NeisResponseError";
    this.code = code;
  }
}

function isoDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function eventId(
  schoolCode: string,
  date: string,
  title: string,
  content: string,
  grades: readonly number[],
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${title}\u0000${content}\u0000${grades.join(",")}`),
  );
  const hash = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("").slice(0, 20);
  return `neis:${schoolCode}:${date}:${hash}`;
}

export async function parseNeisSchedulePage(
  value: unknown,
): Promise<NeisSchedulePage> {
  const emptyResult = emptyResponseSchema.safeParse(value);
  if (emptyResult.success) {
    if (emptyResult.data.RESULT.CODE === "INFO-200") {
      return { totalCount: 0, events: [] };
    }
    throw new NeisResponseError(
      emptyResult.data.RESULT.CODE,
      emptyResult.data.RESULT.MESSAGE,
    );
  }

  const parsed = successResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new NeisResponseError("INVALID_RESPONSE", parsed.error.message);
  }
  const [head, rows] = parsed.data.SchoolSchedule;
  const result = head.head[1].RESULT;
  if (result.CODE !== "INFO-000") {
    throw new NeisResponseError(result.CODE, result.MESSAGE);
  }

  const events = await Promise.all(rows.row.map(async (row) => {
    const grades = [
      row.ONE_GRADE_EVENT_YN === "Y" ? 1 : null,
      row.TW_GRADE_EVENT_YN === "Y" ? 2 : null,
      row.THREE_GRADE_EVENT_YN === "Y" ? 3 : null,
    ].filter((grade): grade is number => grade !== null);
    return {
      id: await eventId(
        row.SD_SCHUL_CODE,
        row.AA_YMD,
        row.EVENT_NM,
        row.EVENT_CNTNT,
        grades,
      ),
      source: "neis" as const,
      schoolCode: row.SD_SCHUL_CODE,
      date: isoDate(row.AA_YMD),
      title: row.EVENT_NM,
      content: row.EVENT_CNTNT,
      grades,
      isSchoolDay: row.SBTR_DD_SC_NM === "해당없음",
      sourceUpdatedAt: isoDate((row.LOAD_DTM ?? row.AA_YMD).slice(0, 8)),
    };
  }));

  return { totalCount: head.head[0].list_total_count, events };
}

export function academicYearRange(date: Date): { readonly from: string; readonly to: string } {
  const koreaDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const koreaYear = koreaDate.getUTCFullYear();
  const koreaMonth = koreaDate.getUTCMonth();
  const startYear = koreaMonth < 2 ? koreaYear - 1 : koreaYear;
  const februaryEnd = new Date(Date.UTC(startYear + 1, 2, 0)).getUTCDate();
  return {
    from: `${startYear}0301`,
    to: `${startYear + 1}02${String(februaryEnd).padStart(2, "0")}`,
  };
}
