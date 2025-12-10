import { EmployeeUsers } from "./employee-users.model";
import { Locations } from "./locations.model";
import { Status } from "./status.model";

export class Scanner {
  scannerId: string;
  scannerCode: string;
  scannerType: string; 
  name: string;
  locationId: string;
  dateCreated: Date;
  lastUpdatedAt: Date | null;
  assignedEmployeeUser: EmployeeUsers;
  createdBy: EmployeeUsers;
  location: Locations;
  status: Status;
  updatedBy: EmployeeUsers;
}
