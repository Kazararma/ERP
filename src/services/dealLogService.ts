import { collection, doc, getDocs, setDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DealLog, DealLogTab } from "@/types/dealLog";

const LOGS_COLLECTION = "dealLogs";

export const dealLogService = {
  async addLog(
    tab: DealLogTab,
    action: string,
    description: string,
    actorId: string,
    actorName: string,
    relatedId?: string
  ): Promise<void> {
    const ref = doc(collection(db, LOGS_COLLECTION));
    const log: DealLog = {
      logId: ref.id,
      tab,
      action,
      description,
      actorId,
      actorName,
      relatedId,
      timestamp: serverTimestamp() as any,
    };
    await setDoc(ref, log);
  },

  async getLogsByTab(tab: DealLogTab): Promise<DealLog[]> {
    const q = query(
      collection(db, LOGS_COLLECTION),
      where("tab", "==", tab),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DealLog);
  },
};
