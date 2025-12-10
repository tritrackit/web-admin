// src/app/models/statistics.model.ts

// ==================== ENUMS ====================
export enum TimeframeType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

// ==================== BASE RESPONSE ====================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ==================== FILTER DTOs ====================
export interface TimeframeDto {
  type: TimeframeType;
  startDate?: string;
  endDate?: string;
}

export interface StatisticsFilterDto {
  timeframe: TimeframeDto;
  locationIds?: string[];
  modelIds?: string[];
  statusNames?: string[];
  colors?: string[];
}

// ==================== DASHBOARD RESPONSE MODELS ====================
export interface DateRange {
  from: string;
  to: string;
}

export interface DashboardMetadata {
  generatedAt: string;
  timeframe: TimeframeDto;
  filtersApplied: string[];
  dateRange: DateRange;
}

export interface DashboardSummary {
  totalUnits: number;
  unitsInStorage: number;
  unitsOnHold: number;
  unitsForDelivery: number;
  unitsCreatedInPeriod: number;
}

export interface ColorDistributionItem {
  color: string;
  count: number;
  percentage: string;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string[];
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface DashboardResponse {
  metadata: DashboardMetadata;
  summary: DashboardSummary;
  colorDistribution: ColorDistributionItem[];
  chartData: {
    unitsByModel: ChartData;
  };
}

// ==================== REPORT RESPONSE MODELS ====================
export interface ReportMetadata {
  generatedAt: string;
  timeframe: TimeframeDto;
  periodDisplay: string;
  filtersApplied: string[];
  dateRange: DateRange;
}

export interface ReportSummary {
  totalUnits: number;
  deliveredUnits: number;
  deliveryRate: string;
  pendingUnits: number;
}

export interface ModelReportItem {
  modelName: string;
  totalUnits: number;
  deliveredUnits: number;
  deliveryRate: string;
}

export interface ColorReportItem {
  color: string;
  totalUnits: number;
  deliveredUnits: number;
  deliveryRate: string;
}

export interface ReportChartData {
  totalUnitsByModel: ChartData;
  totalVsDelivered: ChartData;
}

export interface ProductionReportResponse {
  metadata: ReportMetadata;
  summary: ReportSummary;
  byModel: ModelReportItem[];
  byColor: ColorReportItem[];
  chartData: ReportChartData;
  insights: string[];
}

// ==================== METADATA MODELS ====================
export interface FilterLocation {
  locationId: string;
  name: string;
  locationCode: string;
}

export interface FilterStatus {
  statusId: string;
  name: string;
}

export interface FilterModel {
  modelId: string;
  modelName: string;
}

// Optional: If you have metadata endpoints
export interface MetadataResponse {
  locations: FilterLocation[];
  statuses: FilterStatus[];
  models: FilterModel[];
  colors: string[];
}