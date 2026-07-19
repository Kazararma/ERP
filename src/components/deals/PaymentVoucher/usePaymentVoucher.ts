import { useState } from 'react';
import { PaymentVoucherFormValues } from './paymentVoucherSchema';
import { postPaymentVoucherEntry } from '@/services/ledgerProfileService';

export function usePaymentVoucher() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values: PaymentVoucherFormValues) {
    setIsSubmitting(true);
    try {
      await postPaymentVoucherEntry({
        ...values,
        source: 'manual-payment',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
