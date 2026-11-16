import { z } from "npm:zod@4.1.5";

export const NoticeTargetDateSchema = z.union([z.literal(""), z.iso.date()]).optional();

export const SlideshowCountdownSchema = z.object({
  ddayTitle: z.string().max(80).trim().optional(),
  ddayDate: NoticeTargetDateSchema,
}).refine((value) => Boolean(value.ddayTitle) === Boolean(value.ddayDate));

export const NoticeCountdownStateSchema = z.object({
  notices: z.array(z.object({ targetDate: NoticeTargetDateSchema })).optional(),
  slideshow: SlideshowCountdownSchema.optional(),
});
