import { EmployeeUsers } from "./employee-users.model";
import { Units } from "./units.model";
import { File } from "./file.model";

export class Model {
  modelId: string;
  sequenceId: string;
  modelName: string;
  description: string | null;
  dateCreated: Date;
  lastUpdatedAt: Date | null;
  active: boolean;
  createdBy: EmployeeUsers;
  thumbnailFile: File;
  updatedBy: EmployeeUsers;
  units: Units[];
  unitCount: string;
}
