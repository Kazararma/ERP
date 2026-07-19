import { z } from "zod";

export const receiptSchema = z.object({
  section: z.enum(["liabilities", "assets", "expenses", "income"]),
  majorRowKey: z.string().min(1, "Select a major row"),
  minorRowMode: z.enum(["existing", "new", "none"]),
  minorRowSelection: z.string().optional(),
  newMinorRowName: z.string().optional(),
  microRowMode: z.enum(["existing", "new"]),
  microRowSelection: z.string().optional(),
  newMicroRowName: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  direction: z.enum(["add", "subtract"]),
}).refine(data => {
  if (data.minorRowMode === 'existing' && !data.minorRowSelection) return false;
  if (data.minorRowMode === 'new' && !data.newMinorRowName) return false;
  return true;
}, {
  message: "Please specify the minor row",
  path: ["minorRowSelection"]
}).refine(data => {
  if (data.microRowMode === 'existing' && !data.microRowSelection) return false;
  if (data.microRowMode === 'new' && !data.newMicroRowName) return false;
  return true;
}, {
  message: "Please specify the micro row",
  path: ["microRowSelection"]
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;
