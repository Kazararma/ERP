import { useState } from "react";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import { ReceiptFormValues } from "./receiptSchema";

export function useReceiptEntry() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const store = useBalanceSheetStore((s) => s);

  async function submit(values: ReceiptFormValues) {
    setIsSubmitting(true);
    try {
      const delta = values.direction === 'subtract' ? -Math.abs(values.amount) : Math.abs(values.amount);
      const isParent = !!store.parentTitles[values.majorRowKey];
      
      let targetGroupKey = values.majorRowKey;

      if (isParent) {
        if (values.minorRowMode === 'new') {
          // Creating a new Group (Minor Row)
          targetGroupKey = `${values.majorRowKey}.custom_${Date.now()}`;
          store.addGroupWithItem({
            groupKey: targetGroupKey,
            groupTitle: values.newMinorRowName || "New Minor Row",
            side: values.section,
            itemLabel: values.microRowMode === 'new' ? (values.newMicroRowName || "New Micro Row") : (values.newMicroRowName || "Receipt"),
            amount: delta
          });
          // Note: Since we created it with the item, we are done!
          return;
        } else {
          targetGroupKey = values.minorRowSelection!;
        }
      }

      // At this point, targetGroupKey is the Group (Minor Row if it was a Parent, or Major Row if Standalone)
      if (values.microRowMode === 'new') {
        const microName = values.newMicroRowName || "New Micro Row";
        store.addLineItem(targetGroupKey, {
          label: microName,
          amount: delta,
          manualDelta: delta,
          isSystemComputed: false,
        });
      } else {
        const itemId = values.microRowSelection!;
        store.applyRowReceipt({
          rowId: itemId,
          delta,
          reason: "Receipt Adjustment"
        });
      }

      // Simulate network delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
