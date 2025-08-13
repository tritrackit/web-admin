import { EmployeeUsers } from "./employee-users.model";
import { Scanner } from "./scanner.model";
import { UnitLogs } from "./unit-logs.model";
import { Units } from "./units.model";

export class Locations {
  locationId: string;
  locationCode: string;
  name: string;
  dateCreated: Date;
  lastUpdatedAt: Date | null;
  active: boolean;
  createdBy: EmployeeUsers;
  updatedBy: EmployeeUsers;
  scanners: Scanner[];
  unitLogs: UnitLogs[];
  units: Units[];
}
