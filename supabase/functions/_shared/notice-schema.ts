import { z } from "npm:zod@4.1.5";

export const NoticeTargetDateSchema = z.union([z.literal(""), z.iso.date()]).optional();

export const NoticeCountdownStateSchema = z.object({
  notices: z.array(z.object({ targetDate: NoticeTargetDateSchema })).optional(),
});
