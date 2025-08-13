export class ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}
