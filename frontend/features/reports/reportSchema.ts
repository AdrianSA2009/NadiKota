import { z } from "zod";

export const reportSchema = z.object({
  category: z.enum(["pothole", "street_light", "other"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photo: z.custom<Blob>((v) => typeof Blob !== "undefined" && v instanceof Blob, "Foto wajib diunggah"),
});

export type ReportFormData = z.infer<typeof reportSchema>;
