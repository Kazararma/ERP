import { Timestamp } from "firebase/firestore";

export interface MiscellaneousProfile {
  miscId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
