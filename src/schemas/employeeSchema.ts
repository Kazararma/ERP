import { z } from 'zod';

const bankDetailsSchema = z.object({
  accountHolder: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
});

export const employeeSchema = z
  .object({
    name: z.string().min(1, 'Name required'),
    address: z.string().optional(),
    bankDetails: bankDetailsSchema,
    contractType: z.enum(['monthly', 'daily']),
    fixedMonthlySalary: z.number().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === 'monthly') {
      if (!data.fixedMonthlySalary) {
        ctx.addIssue({ code: 'custom', path: ['fixedMonthlySalary'], message: 'Fixed salary required for monthly workers' });
      }
    }
  });

export type EmployeeSchemaType = z.infer<typeof employeeSchema>;
