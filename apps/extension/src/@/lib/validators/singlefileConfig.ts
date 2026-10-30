import { z } from "zod";

export const DEFAULT_ARCHIVAL_TAG_NAME = "singlefile-capture";

export const singlefileConfigSchema = z.object({
  archivalTagName: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .default(DEFAULT_ARCHIVAL_TAG_NAME),
});

export type singlefileConfigInput = z.input<typeof singlefileConfigSchema>;
export type singlefileConfigType = z.infer<typeof singlefileConfigSchema>;
