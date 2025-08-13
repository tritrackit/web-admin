import { EmployeeUsers } from "./employee-users.model";
import { Locations } from "./locations.model";
import { Status } from "./status.model";
import { Units } from "./units.model";

export class UnitLogs {
  unitLogId: string;
  timestamp: Date;
  employeeUser: EmployeeUsers;
  location: Locations;
  prevStatus: Status;
  status: Status;
  unit: Units;
}
