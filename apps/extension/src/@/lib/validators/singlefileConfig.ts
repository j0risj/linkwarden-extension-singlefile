import { z } from "zod";

export const singlefileConfigSchema = z.object({
  maxUploadMB: z.coerce
    .number()
    .int()
    .min(1)
    .max(1024)
    .default(10),
});

export type singlefileConfigInput = z.input<typeof singlefileConfigSchema>;
export type singlefileConfigType = z.infer<typeof singlefileConfigSchema>;
