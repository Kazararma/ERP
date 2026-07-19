import { z } from 'zod';

export const paymentVoucherSchema = z.object({
  entityType: z.enum(['supplier', 'customer']),
  profileId: z.string().min(1, 'Select a profile'),
  amount: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined;
      if (typeof val === 'string') {
        val = val.replace(/,/g, '');
      }
      return Number(val);
    }, 
    z.number({ message: "Enter a valid amount" }).positive('Amount must be greater than zero')
  ),
  paymentDate: z.date(),
  paymentMode: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'other']).default('cash'),
  referenceNumber: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;
