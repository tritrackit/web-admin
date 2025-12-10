// src/app/services/statistics.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ApiResponse,
  StatisticsFilterDto,
  TimeframeType,
  DashboardResponse,
  ProductionReportResponse,
  FilterLocation,
  FilterStatus,
  FilterModel,
  MetadataResponse
} from '../model/statistics.model';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  // ==================== DASHBOARD ENDPOINTS ====================

  /** Get dashboard data with filters */
  getDashboardData(filter: StatisticsFilterDto): Observable<ApiResponse<DashboardResponse>> {
    return this.http.post<ApiResponse<DashboardResponse>>(
      `${this.apiUrl}/statistics/dashboard`, 
      filter
    ).pipe(
      catchError(this.handleError<DashboardResponse>('getDashboardData'))
    );
  }

  /** Get today's dashboard data */
  getTodayDashboard(): Observable<ApiResponse<DashboardResponse>> {
    return this.http.get<ApiResponse<DashboardResponse>>(
      `${this.apiUrl}/statistics/dashboard/today`
    ).pipe(
      catchError(this.handleError<DashboardResponse>('getTodayDashboard'))
    );
  }

  /** Get current week dashboard data */
  getCurrentWeekDashboard(): Observable<ApiResponse<DashboardResponse>> {
    return this.http.get<ApiResponse<DashboardResponse>>(
      `${this.apiUrl}/statistics/dashboard/current-week`
    ).pipe(
      catchError(this.handleError<DashboardResponse>('getCurrentWeekDashboard'))
    );
  }

  /** Get current year dashboard data */
  getCurrentYearDashboard(): Observable<ApiResponse<DashboardResponse>> {
    return this.http.get<ApiResponse<DashboardResponse>>(
      `${this.apiUrl}/statistics/dashboard/current-year`
    ).pipe(
      catchError(this.handleError<DashboardResponse>('getCurrentYearDashboard'))
    );
  }

  // ==================== PRODUCTION REPORT ENDPOINTS ====================

  /** Get monthly production report */
  getMonthlyReport(filter: StatisticsFilterDto): Observable<ApiResponse<ProductionReportResponse>> {
    return this.http.post<ApiResponse<ProductionReportResponse>>(
      `${this.apiUrl}/statistics/reports/monthly`, 
      filter
    ).pipe(
      catchError(this.handleError<ProductionReportResponse>('getMonthlyReport'))
    );
  }

  /** Get current month report */
  getCurrentMonthReport(): Observable<ApiResponse<ProductionReportResponse>> {
    return this.http.get<ApiResponse<ProductionReportResponse>>(
      `${this.apiUrl}/statistics/reports/current-month`
    ).pipe(
      catchError(this.handleError<ProductionReportResponse>('getCurrentMonthReport'))
    );
  }

  /** Get custom report */
  getCustomReport(filter: StatisticsFilterDto): Observable<ApiResponse<ProductionReportResponse>> {
    return this.http.post<ApiResponse<ProductionReportResponse>>(
      `${this.apiUrl}/statistics/reports/custom`, 
      filter
    ).pipe(
      catchError(this.handleError<ProductionReportResponse>('getCustomReport'))
    );
  }

  // ==================== METADATA ENDPOINTS (Optional - if they exist) ====================

  /** Get all filter metadata */
  getAllFilters(): Observable<ApiResponse<MetadataResponse>> {
    return this.http.get<ApiResponse<MetadataResponse>>(
      `${this.apiUrl}/metadata/filters/all`
    ).pipe(
      catchError(this.handleError<MetadataResponse>('getAllFilters'))
    );
  }

  /** Get locations */
  getLocations(): Observable<ApiResponse<FilterLocation[]>> {
    return this.http.get<ApiResponse<FilterLocation[]>>(
      `${this.apiUrl}/metadata/locations`
    ).pipe(
      catchError(this.handleError<FilterLocation[]>('getLocations'))
    );
  }

  /** Get statuses */
  getStatuses(): Observable<ApiResponse<FilterStatus[]>> {
    return this.http.get<ApiResponse<FilterStatus[]>>(
      `${this.apiUrl}/metadata/statuses`
    ).pipe(
      catchError(this.handleError<FilterStatus[]>('getStatuses'))
    );
  }

  /** Get models */
  getModels(): Observable<ApiResponse<FilterModel[]>> {
    return this.http.get<ApiResponse<FilterModel[]>>(
      `${this.apiUrl}/metadata/models`
    ).pipe(
      catchError(this.handleError<FilterModel[]>('getModels'))
    );
  }

  // ==================== HELPER METHODS ====================

  /** Create a daily timeframe filter */
  createDailyFilter(): StatisticsFilterDto {
    return {
      timeframe: { type: TimeframeType.DAILY }
    };
  }

  /** Create a monthly timeframe filter */
  createMonthlyFilter(year: number, month: number): StatisticsFilterDto {
    const monthStr = month.toString().padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    return {
      timeframe: {
        type: TimeframeType.MONTHLY,
        startDate: `${year}-${monthStr}-01`,
        endDate: `${year}-${monthStr}-${daysInMonth}`
      }
    };
  }

  /** Create a custom timeframe filter */
  createCustomFilter(startDate: string, endDate: string): StatisticsFilterDto {
    return {
      timeframe: {
        type: TimeframeType.CUSTOM,
        startDate,
        endDate
      }
    };
  }

  /** Create filter with options */
  createFilterWithOptions(options: Partial<StatisticsFilterDto>): StatisticsFilterDto {
    const filter: StatisticsFilterDto = {
      timeframe: { type: TimeframeType.DAILY }
    };

    if (options.timeframe) {
      filter.timeframe = { ...filter.timeframe, ...options.timeframe };
    }
    
    if (options.locationIds) filter.locationIds = options.locationIds;
    if (options.modelIds) filter.modelIds = options.modelIds;
    if (options.statusNames) filter.statusNames = options.statusNames;
    if (options.colors) filter.colors = options.colors;
    
    return filter;
  }

  // ==================== ERROR HANDLING ====================

  private handleError<T>(operation = 'operation') {
    return (error: any): Observable<ApiResponse<T>> => {
      console.error(`${operation} failed:`, error);
      
      const errorMessage = this.getErrorMessage(error);
      
      // Return a proper error response
      const errorResponse: ApiResponse<T> = {
        success: false,
        message: errorMessage,
        data: null as any
      };
      
      return of(errorResponse);
    };
  }

  private getErrorMessage(error: any): string {
    if (error.error?.message) {
      return Array.isArray(error.error.message) 
        ? error.error.message[0] 
        : error.error.message;
    }
    return error.message || `An error occurred`;
  }
}