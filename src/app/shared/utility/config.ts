import { AccessPages } from "src/app/model/roles.model";
import { ColumnDefinition } from "./table"

export interface AppConfig {
    appName: string;
    tableColumns: {
      employeeUsers: ColumnDefinition[];
      roles: ColumnDefinition[];
      locations: ColumnDefinition[];
      cbu: ColumnDefinition[];
      model: ColumnDefinition[];
    };
    sessionConfig: {
      sessionTimeout: string;
    };
    lookup: {
      accessPages: AccessPages[];
    };
  }
