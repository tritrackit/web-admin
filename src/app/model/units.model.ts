import { EmployeeUsers } from "./employee-users.model";
import { Locations } from "./locations.model";
import { Model } from "./model.model";
import { Status } from "./status.model";
import { UnitLogs } from "./unit-logs.model";

export class Units {
  unitId: string;
  unitCode: string | null;
  rfid: string;
  chassisNo: string;
  modelId: string;
  color: string;
  description: string;
  dateCreated: Date;
  lastUpdatedAt: Date | null;
  active: boolean;
  unitLogs: UnitLogs[];
  createdBy: EmployeeUsers;
  location: Locations;
  model: Model;
  status: Status;
  updatedBy: EmployeeUsers;
  assignedEmployeeUser: EmployeeUsers;
}
