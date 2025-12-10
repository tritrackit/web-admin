import { Roles } from "./roles.model";

export class EmployeeUsers {
    employeeUserId: string;
    employeeUserCode: string;
    userName: string;
    email: string;
    firstName: string;
    lastName: string;
    contactNo: string;
    invitationCode: string;
    accessGranted: boolean;
    active: boolean;
    hasActiveSession: boolean;
    dateCreated: Date;
    lastUpdatedAt: Date;
    role: Roles = {} as any;
    refreshToken: string;
    accessToken: string;
    get fullName(): string {
      return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.userName || 'User';
    }
    
  }

  
