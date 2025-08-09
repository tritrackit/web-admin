import { AccessPages } from "src/app/model/roles.model";
import { ColumnDefinition } from "./table"

export interface AppConfig {
    appName: string;
    tableColumns: {
      employeeUsers: ColumnDefinition[];
      roles: ColumnDefinition[];
      rooms: ColumnDefinition[];
    };
    sessionConfig: {
      sessionTimeout: string;
    };
    lookup: {
      accessPages: AccessPages[];
    };
    apiEndPoints: {
      auth: {
        login: string;
      };
      employeeUsers: {
        getByCode: string;
        createUser: string;
        updateProfile: string;
        updateUser: string;
        getAdvanceSearch: string;
        updateUserPassword: string;
        profileResetPassword: string;
        delete: string;
      };
      roles: {
        getByAdvanceSearch: string;
        getByCode: string;
        create: string;
        update: string;
        delete: string;
      };
      notifications: {
        getByAdvanceSearch: string;
        getUnreadByUser: string;
        marAsRead: string;
      };
      settings: {
        getAll: string;
        find: string;
        update: string;
      };
      dashboard: {
        getDashboardSummary: string;
      };
      message: { create: string };
    };
  }
