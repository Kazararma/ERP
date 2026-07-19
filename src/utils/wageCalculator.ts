import { WageMode } from '@/types/employee';

interface CalculateGrossInput {
  wageMode: WageMode;
  fixedMonthlySalary?: number | null;
  hourlyRate?: number | null;
  ratePerBag?: number | null;
  hoursWorked?: number;
  bagsCompleted?: number;
}

export function calculateGross(input: CalculateGrossInput): number {
  const { wageMode, fixedMonthlySalary, hourlyRate, ratePerBag, hoursWorked, bagsCompleted } = input;

  switch (wageMode) {
    case 'fixed':
      if (!fixedMonthlySalary) throw new Error('Fixed salary not set');
      return fixedMonthlySalary;

    case 'hourly':
      if (!hourlyRate || hourlyRate <= 0) throw new Error('Hourly rate must be greater than zero');
      if (!hoursWorked || hoursWorked <= 0) throw new Error('Hours worked must be greater than zero');
      return parseFloat((hourlyRate * hoursWorked).toFixed(2));

    case 'perBag':
      if (!ratePerBag || ratePerBag <= 0) throw new Error('Rate per bag must be greater than zero');
      if (!bagsCompleted || bagsCompleted <= 0) throw new Error('Bags completed must be greater than zero');
      return parseFloat((ratePerBag * bagsCompleted).toFixed(2));

    default:
      throw new Error('Unknown wage mode');
  }
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• ${accountNumber.slice(-4)}`;
}
