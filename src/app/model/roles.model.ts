export class Roles {
  roleId: string;
  roleCode: string;
  name: string;
  active?: boolean;
  accessPages?: AccessPages[];
}

export class AccessPages {
  page?: string;
  view?: boolean;
  modify?: boolean;
  rights?: string[] = [];
}
