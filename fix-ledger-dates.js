import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

admin.initializeApp({
  projectId: "crmsaas",
});
const db = getFirestore();

async function fixLedgerDates() {
  const ledgerProfilesSnap = await db.collection("ledgerProfiles").get();
  for (const profile of ledgerProfilesSnap.docs) {
    const entriesSnap = await profile.ref.collection("entries").get();
    for (const entry of entriesSnap.docs) {
      const data = entry.data();
      if (data.isSystemGenerated && data.relatedDocId) {
        if (data.entryType === "delivery_confirmed") {
          const dealSnap = await db.collection("deals").doc(data.relatedDocId).get();
          if (dealSnap.exists) {
            const dealData = dealSnap.data();
            if (dealData?.purchaseDate && dealData.purchaseDate.toMillis() !== data.date.toMillis()) {
              console.log(`Fixing deal ledger date for ${data.relatedDocId}`);
              await entry.ref.update({ date: dealData.purchaseDate });
            }
          }
        } else if (data.entryType === "order_confirmed") {
          const orderSnap = await db.collection("orders").doc(data.relatedDocId).get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data();
            if (orderData?.createdAt && orderData.createdAt.toMillis() !== data.date.toMillis()) {
              console.log(`Fixing order ledger date for ${data.relatedDocId}`);
              await entry.ref.update({ date: orderData.createdAt });
            }
          }
        }
      }
    }
  }
}

fixLedgerDates().then(() => console.log("Done")).catch(console.error);
