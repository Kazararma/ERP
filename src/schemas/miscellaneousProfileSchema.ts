import { z } from "zod";

export const miscellaneousProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
});

export type MiscellaneousProfileFormValues = z.infer<typeof miscellaneousProfileSchema>;
