
import { EmployeeUsers } from "./employee-users.model";

export class Notifications {
  notificationId: string;
  title: string;
  description: string;
  type: string;
  referenceId: string;
  isRead: boolean;
  user: EmployeeUsers;
  date: string;
}
