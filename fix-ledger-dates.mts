import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixLedgerDates() {
  console.log("Starting ledger date fix...");
  const ledgerProfilesSnap = await getDocs(collection(db, "ledgerProfiles"));
  
  for (const profile of ledgerProfilesSnap.docs) {
    const entriesSnap = await getDocs(collection(db, `ledgerProfiles/${profile.id}/entries`));
    
    for (const entry of entriesSnap.docs) {
      const data = entry.data();
      
      if (data.isSystemGenerated && data.relatedDocId) {
        if (data.entryType === "delivery_confirmed") {
          const dealSnap = await getDoc(doc(db, "deals", data.relatedDocId));
          if (dealSnap.exists()) {
            const dealData = dealSnap.data();
            if (dealData?.purchaseDate && dealData.purchaseDate.toMillis() !== data.date.toMillis()) {
              console.log(`Fixing deal ledger date for ${data.relatedDocId}`);
              await updateDoc(entry.ref, { date: dealData.purchaseDate });
            }
          }
        } else if (data.entryType === "order_confirmed") {
          const orderSnap = await getDoc(doc(db, "orders", data.relatedDocId));
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            if (orderData?.createdAt && orderData.createdAt.toMillis() !== data.date.toMillis()) {
              console.log(`Fixing order ledger date for ${data.relatedDocId}`);
              await updateDoc(entry.ref, { date: orderData.createdAt });
            }
          }
        }
      }
    }
  }
  console.log("Finished ledger date fix.");
}

fixLedgerDates().then(() => process.exit(0)).catch(console.error);
