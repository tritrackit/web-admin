export class ColumnDefinition {
  name: string;
  label: string;
  apiNotation?: string;
  sticky?: boolean;
  style?: ColumnStyle;
  controls?: boolean;
  disableSorting?: boolean;
  format?: {
    type: "currency" | "date" | "date-time" | "number" | "custom" | "image";
    custom: string;
  };
  hide?: boolean;
  type?: "string" | "boolean" | "date" | "number" = "string";
  filterOptions: ColumnDefinitionFilterOptions;
  urlPropertyName?: string;
  filter: any;
}

export class ColumnDefinitionFilterOptions {
  placeholder?: string;
  enable?: boolean;
  type?: "text" | "option" | "option-yes-no" | "date" | "date-range" | "number" | "number-range" | "precise";
};
export class ColumnStyle {
  width: string;
  left: string;
  //  to be added style properties
}

export class TableColumnBase {
  menu: any[] = [];
}

export class EmployeeUsersTableColumn {
  employeeUserCode?: string;
  userName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enable?: boolean;
  role?: string;
  url?: string;
  contactNo: string;
  dateCreated?: Date;
}

export class EmployeeUserTableColumn {
  employeeUserCode?: string;
  name?: string;
  mobileNumber?: string;
  userProfilePic?: string;
}

export class RolesTableColumn {
  roleId: string;
  roleCode: string;
  name?: string;
  url?: string;
}
export class LocationsTableColumn {
  locationId?: string;
  locationCode?: string;
  name?: string;
  url?: string;
}
export class CBUTableColumn {
  unitId?: string;
  unitCode?: string;
  chassisNo?: string;
  model?: string;
  color?: string;
  url?: string;
}
export class ModelTableColumn {
  modelId?: string;
  sequenceId?: string;
  modelName?: string;
  description?: string;
  unitCount?: string;
  url?: string;
}
export class ScannerTableColumn {
  scannerId?: string;
  scannerCode?: string;
  name?: string;
  location?: string;
  assignedEmployeeUser?: string;
  url?: string;
}

