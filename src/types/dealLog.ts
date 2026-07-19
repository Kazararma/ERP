import { Timestamp } from "firebase/firestore";

export type DealLogTab = "bought" | "staging" | "sold";

export interface DealLog {
  logId: string;
  tab: DealLogTab;
  action: string;
  description: string;
  actorName: string;
  actorId: string;
  relatedId?: string; // dealId, batchId, orderId
  timestamp: Timestamp;
}
