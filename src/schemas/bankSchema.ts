import { z } from 'zod';

export const bankSchema = z.object({
  name: z.string().min(2, 'Bank name must be at least 2 characters'),
  principalAmount: z.number().min(0, 'Opening balance cannot be negative'),
});

export const adjustPrincipalSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  direction: z.enum(['increase', 'decrease']),
  note: z.string().optional().default(''),
});

export const paySalarySchema = z
  .object({
    bankId: z.string().min(1, 'Select a bank to pay from'),
    wageMode: z.enum(['fixed', 'hourly', 'perBag']),
    hoursWorked: z.number().positive().optional(),
    bagsCompleted: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.wageMode === 'hourly' && !data.hoursWorked) {
      ctx.addIssue({ code: 'custom', path: ['hoursWorked'], message: 'Hours worked required' });
    }
    if (data.wageMode === 'perBag' && !data.bagsCompleted) {
      ctx.addIssue({ code: 'custom', path: ['bagsCompleted'], message: 'Bags completed required' });
    }
  });
