import { Rooms } from "./rooms";
import { EmployeeUsers } from "./employee-users.model";

export class Maintenance {
  maintenanceId: string;
  maintenanceCode: string | null;
  title: string | null;
  description: string | null;
  createdDateTime: Date;
  startDateTime: Date;
  completedDateTime: Date | null;
  status: "OPEN" | "ACTIVE" | "CLOSED";
  type: string;
  remarks: string;
  active: boolean;
  assignedUser: EmployeeUsers;
  room: Rooms;
  maintenanceHistory: Maintenance[] = [];
  attachments: string[] = [];
}
