import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatisticsService } from 'src/app/services/statistics.service';
import { StorageService } from 'src/app/services/storage.service';
import { ProductionReportResponse, ReportSummary, ModelReportItem, ColorReportItem, StatisticsFilterDto, TimeframeType } from 'src/app/model/statistics.model';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { Subscription } from 'rxjs';
import { jsPDF } from 'jspdf';
import moment from 'moment';
import {
  ChartComponent,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexTitleSubtitle,
  ApexLegend,
  ApexFill,
  ApexTooltip
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  plotOptions: any;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  legend: ApexLegend;
  fill: ApexFill;
  tooltip: ApexTooltip;
  colors: string[];
};

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  host: {
    class: "page-component"
  }
})
export class ReportsComponent implements OnInit, OnDestroy {
  @ViewChild('reportContent', { static: false }) reportContent: ElementRef;
  @ViewChild('chart', { static: false }) chart: ChartComponent;

  loading: boolean = false;
  error: string = '';
  currentUser: EmployeeUsers | null = null;
  
  public chartOptions: Partial<ChartOptions> = {
    series: [{ name: 'Units', data: [0, 0] }],
    chart: { 
      type: 'bar', 
      height: 400, 
      toolbar: { show: false },
      width: '100%'
    },
    plotOptions: { bar: { horizontal: false, columnWidth: '50%' } },
    dataLabels: { enabled: true },
    xaxis: { categories: ['Built', 'Delivered'] },
    yaxis: { 
      min: 0, 
      max: 100, // Will be dynamically updated based on data
      tickAmount: 5,
      labels: {
        formatter: (val: number) => {
          return val.toString();
        }
      }
    },
    legend: { show: true, position: 'top' },
    fill: { opacity: 1 },
    colors: ['#FF9800', '#2196F3']
  };

  // Month filter
  monthFilter = new FormControl();
  availableMonths: { value: string; label: string }[] = [];
  selectedMonth: { year: number; month: number } | null = null;

  // Report data
  reportData: ProductionReportResponse | null = null;
  summary: ReportSummary = {
    totalUnits: 0,
    deliveredUnits: 0,
    deliveryRate: '0.00%',
    pendingUnits: 0
  };

  // Table data
  modelData: ModelReportItem[] = [];
  colorData: ColorReportItem[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private statisticsService: StatisticsService,
    private snackBar: MatSnackBar,
    private storageService: StorageService
  ) {
    this.currentUser = this.storageService.getLoginProfile();
    this.initializeMonths();
    // Set default to current month
    const now = new Date();
    this.selectedMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    this.monthFilter.setValue(this.getMonthValue(this.selectedMonth.year, this.selectedMonth.month));
  }

  ngOnInit(): void {
    this.loadReportData();
    
    // Listen to month filter changes
    const monthSub = this.monthFilter.valueChanges.subscribe(value => {
      if (value) {
        const [year, month] = value.split('-').map(Number);
        this.selectedMonth = { year, month };
        this.loadReportData();
      }
    });
    this.subscriptions.push(monthSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeMonths(): void {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthValue = `${year}-${month.toString().padStart(2, '0')}`;
      const monthLabel = moment(date).format('MMMM YYYY').toUpperCase();
      months.push({ value: monthValue, label: monthLabel });
    }

    this.availableMonths = months;
  }

  private getMonthValue(year: number, month: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  loadReportData(): void {
    if (!this.selectedMonth) return;

    this.loading = true;
    this.error = '';

    const filter: StatisticsFilterDto = this.statisticsService.createMonthlyFilter(
      this.selectedMonth.year,
      this.selectedMonth.month
    );

    const sub = this.statisticsService.getMonthlyReport(filter).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          this.reportData = response.data;
          this.updateReportData(response.data);
        } else {
          this.error = response.message || 'Failed to load report data';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading report data. Please try again.';
        this.snackBar.open('Error loading report data', 'Close', { duration: 3000 });
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Calculate dynamic Y-axis maximum based on data values
   * Adds padding and rounds to nice numbers for better visualization
   */
  private calculateYAxisMax(data: number[]): number {
    if (!data || data.length === 0) {
      return 100; // Default minimum
    }

    const maxValue = Math.max(...data);
    
    if (maxValue === 0) {
      return 100; // Default minimum when all values are 0
    }

    // Add 20% padding above the max value
    let paddedMax = maxValue * 1.2;

    // Round to nice numbers based on the magnitude
    if (paddedMax <= 10) {
      // For values 0-10, round to nearest 2
      paddedMax = Math.ceil(paddedMax / 2) * 2;
    } else if (paddedMax <= 50) {
      // For values 10-50, round to nearest 5
      paddedMax = Math.ceil(paddedMax / 5) * 5;
    } else if (paddedMax <= 100) {
      // For values 50-100, round to nearest 10
      paddedMax = Math.ceil(paddedMax / 10) * 10;
    } else if (paddedMax <= 500) {
      // For values 100-500, round to nearest 50
      paddedMax = Math.ceil(paddedMax / 50) * 50;
    } else if (paddedMax <= 1000) {
      // For values 500-1000, round to nearest 100
      paddedMax = Math.ceil(paddedMax / 100) * 100;
    } else if (paddedMax <= 5000) {
      // For values 1000-5000, round to nearest 500
      paddedMax = Math.ceil(paddedMax / 500) * 500;
    } else {
      // For values above 5000, round to nearest 1000
      paddedMax = Math.ceil(paddedMax / 1000) * 1000;
    }

    // Ensure minimum of 100 for visibility
    return Math.max(paddedMax, 100);
  }

  /**
   * Calculate appropriate step size for Y-axis ticks based on max value
   */
  private calculateYAxisStepSize(maxValue: number): number {
    if (maxValue <= 10) return 2;
    if (maxValue <= 50) return 5;
    if (maxValue <= 100) return 10;
    if (maxValue <= 500) return 50;
    if (maxValue <= 1000) return 100;
    if (maxValue <= 5000) return 500;
    return 1000;
  }

  /**
   * Get responsive chart height based on window width
   */
  private getResponsiveChartHeight(): number {
    if (typeof window === 'undefined') {
      return 400; // Default for SSR
    }
    
    const width = window.innerWidth;
    if (width <= 400) {
      return 200;
    } else if (width <= 600) {
      return 250;
    } else if (width <= 960) {
      return 300;
    }
    return 400; // Default for desktop
  }

  /**
   * Map colors to labels based on label content
   * Orange for "Total Units Created" or "Built", Blue for "Units Delivered" or "Delivered"
   * This is a fallback if API doesn't provide colors
   */
  private mapColorsToLabels(labels: string[]): string[] {
    const colors: string[] = [];
    const orangeColor = '#FF9800'; // Orange
    const blueColor = '#2196F3';    // Blue
    
    labels.forEach(label => {
      const lowerLabel = label.toLowerCase();
      // Check if label is for "Total Units Created" or "Built"
      if (lowerLabel.includes('total units created') || 
          lowerLabel.includes('built') || 
          lowerLabel.includes('total units')) {
        colors.push(orangeColor);
  }
      // Check if label is for "Units Delivered" or "Delivered"
      else if (lowerLabel.includes('units delivered') || 
               lowerLabel.includes('delivered')) {
        colors.push(blueColor);
      } 
      // Default: first bar orange, second bar blue
      else {
        const index = labels.indexOf(label);
        colors.push(index === 0 ? orangeColor : blueColor);
      }
    });
    
    return colors;
  }

  private updateReportData(data: ProductionReportResponse): void {
    // Update summary
    this.summary = { ...data.summary };

    // Update table data
    this.modelData = [...data.byModel];
    this.colorData = [...data.byColor];

    // Update chart data from API response or use summary data
    let chartLabels: string[] = ['Built', 'Delivered'];
    let chartData: number[] = [data.summary.totalUnits || 0, data.summary.deliveredUnits || 0];
    let chartColors: string[] = ['#FF9800', '#2196F3']; // Default: Orange & Blue
    
    // Use chartData from API if available
    if (data.chartData && data.chartData.totalVsDelivered) {
      const totalVsDelivered = data.chartData.totalVsDelivered;
      if (totalVsDelivered.labels && totalVsDelivered.labels.length > 0) {
        chartLabels = totalVsDelivered.labels;
      }
      if (totalVsDelivered.datasets && totalVsDelivered.datasets.length > 0) {
        const dataset = totalVsDelivered.datasets[0];
        chartData = dataset.data || chartData;
        
        // Use colors from API if provided (backend provides: ["#FF9800", "#2196F3"])
        if (dataset.backgroundColor && dataset.backgroundColor.length > 0) {
          chartColors = dataset.backgroundColor;
        }
      }
    }
    
    // If colors weren't provided by API, map them based on label content
    if (chartColors.length !== chartLabels.length) {
      chartColors = this.mapColorsToLabels(chartLabels);
    }
    
    // Calculate dynamic Y-axis max and step size based on actual data
    const yAxisMax = this.calculateYAxisMax(chartData);
    const yAxisStepSize = this.calculateYAxisStepSize(yAxisMax);
    
    // Calculate responsive chart height based on window width
    const chartHeight = this.getResponsiveChartHeight();
    
    // Update chart with new data - create new object to trigger change detection
    this.chartOptions = {
      ...this.chartOptions,
      chart: {
        ...this.chartOptions.chart,
        height: chartHeight,
        width: '100%'
      },
      series: [{
        name: 'Units',
        data: chartData
      }],
      xaxis: {
        ...this.chartOptions.xaxis,
        categories: chartLabels
      },
      yaxis: {
        ...this.chartOptions.yaxis,
        min: 0,
        max: yAxisMax,
        tickAmount: Math.ceil(yAxisMax / yAxisStepSize),
        labels: {
          ...this.chartOptions.yaxis?.labels,
          formatter: (val: number) => {
            return val.toString();
          }
        }
      },
      colors: chartColors
    };
    
    // Force chart update if chart is already rendered
    if (this.chart && this.chart.chart) {
      setTimeout(() => {
        this.chart.updateSeries([{
          name: 'Units',
          data: chartData
        }]);
        // Also update the Y-axis and colors
        this.chart.updateOptions({
          yaxis: {
            min: 0,
            max: yAxisMax,
            tickAmount: Math.ceil(yAxisMax / yAxisStepSize)
          },
          colors: chartColors
        });
      }, 100);
    }
  }

  exportToPDF(): void {
    if (!this.reportData) {
      this.snackBar.open('No data to export', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;

    try {
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Header - Logo and Title
      pdf.setFillColor(255, 152, 0); // Orange
      pdf.setFontSize(24);
      pdf.setTextColor(255, 152, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TriMotors', margin, yPosition + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Technology Corporation', margin, yPosition + 16);

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MONTHLY CBU REPORT', pageWidth / 2, yPosition + 30, { align: 'center' });

      yPosition += 40;

      // Report Information Box
      checkPageBreak(25);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, contentWidth, 20, 'F');
      
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      
      const monthLabel = this.getSelectedMonthLabel();
      const currentDate = moment().format('MMMM DD, YYYY');
      const employeeName = this.currentUser?.fullName || this.currentUser?.userName || '[EMPLOYEE NAME]';
      
      pdf.text(`Month Covered: ${monthLabel}`, margin + 5, yPosition + 7);
      pdf.text(`Generated by: ${employeeName}`, margin + 5, yPosition + 12);
      pdf.text(`Date Generated: ${currentDate}`, margin + 5, yPosition + 17);

      yPosition += 30;

      // Summary Overview Table
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary Overview', margin, yPosition);
      yPosition += 5;

      // Table header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, yPosition, contentWidth, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Metric', margin + 2, yPosition + 6);
      pdf.text('Total Count', margin + contentWidth - 40, yPosition + 6, { align: 'right' });
      yPosition += 8;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      pdf.text('CBUs Built', margin + 2, yPosition + 6);
      pdf.text(this.summary.totalUnits.toString(), margin + contentWidth - 2, yPosition + 6, { align: 'right' });
      yPosition += 8;

      pdf.text('CBUs Delivered', margin + 2, yPosition + 6);
      pdf.text(this.summary.deliveredUnits.toString(), margin + contentWidth - 2, yPosition + 6, { align: 'right' });
      yPosition += 8;

      pdf.text('Remaining CBUs', margin + 2, yPosition + 6);
      pdf.text(this.summary.pendingUnits.toString(), margin + contentWidth - 2, yPosition + 6, { align: 'right' });
      yPosition += 15;

      // Breakdown by Model Table
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Breakdown by Model', margin, yPosition);
      yPosition += 5;

      // Table header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, yPosition, contentWidth, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Metric', margin + 2, yPosition + 6);
      pdf.text('CBUs Built', margin + contentWidth / 2 - 20, yPosition + 6, { align: 'center' });
      pdf.text('Total Count', margin + contentWidth - 2, yPosition + 6, { align: 'right' });
      yPosition += 8;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      this.modelData.forEach(item => {
        checkPageBreak(8);
        pdf.text(item.modelName, margin + 2, yPosition + 6);
        pdf.text(item.totalUnits.toString(), margin + contentWidth / 2 - 20, yPosition + 6, { align: 'center' });
        pdf.text(item.deliveredUnits.toString(), margin + contentWidth - 2, yPosition + 6, { align: 'right' });
        yPosition += 8;
      });
      yPosition += 10;

      // Breakdown by Color Table
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Breakdown by Color', margin, yPosition);
      yPosition += 5;

      // Table header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, yPosition, contentWidth, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Metric', margin + 2, yPosition + 6);
      pdf.text('CBUs Built', margin + contentWidth / 2 - 20, yPosition + 6, { align: 'center' });
      pdf.text('Total Count', margin + contentWidth - 2, yPosition + 6, { align: 'right' });
      yPosition += 8;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      this.colorData.forEach(item => {
        checkPageBreak(8);
        pdf.text(item.color, margin + 2, yPosition + 6);
        pdf.text(item.totalUnits.toString(), margin + contentWidth / 2 - 20, yPosition + 6, { align: 'center' });
        pdf.text(item.deliveredUnits.toString(), margin + contentWidth - 2, yPosition + 6, { align: 'right' });
        yPosition += 8;
      });

      // Footer
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Tri-TrackIT System - Confidential Internal Report. For official use only. All data is auto-generated by the Tri-TrackIT platform.', 
        pageWidth / 2, footerY, { align: 'center', maxWidth: contentWidth });

      // Generate filename
      const monthLabelFile = this.monthFilter.value 
        ? moment(this.monthFilter.value + '-01').format('MMMM_YYYY')
        : 'Report';
      const filename = `Monthly_CBU_Report_${monthLabelFile}.pdf`;

      pdf.save(filename);
      this.loading = false;
      this.snackBar.open('Report exported to PDF successfully', 'Close', { duration: 3000 });
    } catch (error) {
      this.loading = false;
      this.snackBar.open('Error exporting to PDF', 'Close', { duration: 3000 });
    }
  }

  getSelectedMonthLabel(): string {
    if (!this.monthFilter.value) return '';
    return moment(this.monthFilter.value + '-01').format('MMMM YYYY').toUpperCase();
  }
}
