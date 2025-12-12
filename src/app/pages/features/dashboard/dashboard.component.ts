import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { StatisticsService } from 'src/app/services/statistics.service';
import { DashboardResponse, DashboardSummary, ChartData as StatisticsChartData } from 'src/app/model/statistics.model';
import { StorageService } from 'src/app/services/storage.service';
import { UnitService } from 'src/app/services/unit.service';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { Units } from 'src/app/model/units.model';
import { Subscription } from 'rxjs';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { MatTableDataSource } from '@angular/material/table';
import moment from 'moment';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  host: {
    class: "page-component"
  }
})
export class DashboardComponent implements OnInit, OnDestroy {
  profile: EmployeeUsers;
  userNam: string = '';
  firstName: string = '';
  currentDate: string = '';
  
  loading: boolean = false;
  error: string = '';
  
  // Summary data
  summary: DashboardSummary = {
    totalUnits: 0,
    unitsInStorage: 0,
    unitsOnHold: 0,
    unitsForDelivery: 0,
    unitsCreatedInPeriod: 0
  };
  
  // Chart data
  public barChartType: ChartType = 'bar';
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 5
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    }
  };
  
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };
  
  // Table data
  tableData: Array<{
    modelName: string;
    icon?: string;
    colors: { [color: string]: number };
    total: number;
  }> = [];
  
  tableDataSource = new MatTableDataSource(this.tableData);
  
  allColors: string[] = [];
  
  // Model totals for today
  modelTotalsToday: Array<{
    modelName: string;
    total: number;
    icon?: string;
  }> = [];
  
  // Filter controls
  filterType = new FormControl('all'); // 'all', 'day', 'month'
  selectedDate = new FormControl(moment().toDate());
  selectedMonth = new FormControl(moment().format('YYYY-MM'));
  
  // Available months for dropdown
  availableMonths: { value: string; label: string }[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private statisticsService: StatisticsService,
    private storageService: StorageService,
    private unitService: UnitService
  ) {
    this.profile = this.storageService.getLoginProfile();
    if (this.profile) {
      this.firstName = this.profile.firstName || 'User';
    }
    this.currentDate = moment().format('MMMM D, YYYY');
  }

  ngOnInit(): void {
    this.initializeMonths();
    this.loadDashboardData();
    
    // Subscribe to filter changes
    const filterSub = this.filterType.valueChanges.subscribe(() => {
      this.onFilterChange();
    });
    this.subscriptions.push(filterSub);
    
    const dateSub = this.selectedDate.valueChanges.subscribe(() => {
      if (this.filterType.value === 'day') {
        this.onFilterChange();
      }
    });
    this.subscriptions.push(dateSub);
    
    const monthSub = this.selectedMonth.valueChanges.subscribe(() => {
      if (this.filterType.value === 'month') {
        this.onFilterChange();
      }
    });
    this.subscriptions.push(monthSub);
    
    // Subscribe to unit refresh events for real-time updates
    const refreshSub = this.unitService.refresh$.subscribe(() => {
      this.loadUnitsData();
    });
    this.subscriptions.push(refreshSub);
  }
  
  initializeMonths(): void {
    const months: { value: string; label: string }[] = [];
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = moment().subtract(i, 'months');
      const year = date.year();
      const month = date.month() + 1;
      const monthValue = `${year}-${month.toString().padStart(2, '0')}`;
      const monthLabel = date.format('MMMM YYYY').toUpperCase();
      months.push({ value: monthValue, label: monthLabel });
    }
    
    this.availableMonths = months;
  }
  
  onFilterChange(): void {
    this.loadUnitsData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = '';
    
    // Load dashboard summary
    const dashboardSub = this.statisticsService.getTodayDashboard().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.summary = { ...response.data.summary };
          
          // Calculate model totals from dashboard chart data if available
          if (response.data.chartData?.unitsByModel) {
            this.calculateModelTotalsFromChartData(response.data.chartData.unitsByModel);
          }
          
          // Load units for chart and table
          this.loadUnitsData();
        } else {
          this.loading = false;
          this.error = response.message || 'Failed to load dashboard data';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading dashboard data. Please try again.';
      }
    });
    
    this.subscriptions.push(dashboardSub);
  }

  loadUnitsData(): void {
    this.loading = true;
    
    // Fetch all units to aggregate by model and color
    const params = {
      order: { dateCreated: 'DESC' },
      columnDef: [],
      pageSize: 10000, // Large number to get all units
      pageIndex: 0
    };

    const unitsSub = this.unitService.getByAdvanceSearch(params).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data?.results) {
          // Filter units based on selected filter
          const filteredUnits = this.filterUnits(response.data.results);
          this.processUnitsData(filteredUnits);
          // Calculate model totals for today (always show today's breakdown in summary)
          this.calculateModelTotalsToday(response.data.results);
        } else {
          this.error = 'Failed to load units data';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading units data';
      }
    });

    this.subscriptions.push(unitsSub);
  }
  
  filterUnits(units: Units[]): Units[] {
    const filterType = this.filterType.value;
    
    if (filterType === 'all') {
      return units;
    } else if (filterType === 'day') {
      const selectedDate = this.selectedDate.value;
      if (!selectedDate) return units;
      
      const filterDate = moment(selectedDate).startOf('day');
      const filterDateEnd = moment(selectedDate).endOf('day');
      
      return units.filter(unit => {
        if (!unit.dateCreated) return false;
        const unitDate = moment(unit.dateCreated);
        return unitDate.isSameOrAfter(filterDate) && unitDate.isSameOrBefore(filterDateEnd);
      });
    } else if (filterType === 'month') {
      const selectedMonth = this.selectedMonth.value;
      if (!selectedMonth) return units;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = moment({ year, month: month - 1, day: 1 }).startOf('day');
      const monthEnd = moment({ year, month: month - 1, day: 1 }).endOf('month');
      
      return units.filter(unit => {
        if (!unit.dateCreated) return false;
        const unitDate = moment(unit.dateCreated);
        return unitDate.isSameOrAfter(monthStart) && unitDate.isSameOrBefore(monthEnd);
      });
    }
    
    return units;
  }

  processUnitsData(units: Units[]): void {
    // Aggregate units by model and color
    const modelColorMap: { [modelName: string]: { [color: string]: number } } = {};
    const colorSet = new Set<string>();

    units.forEach(unit => {
      if (unit.model && unit.color) {
        const modelName = unit.model.modelName?.trim() || 'Unknown';
        const color = unit.color.trim().toUpperCase();
        
        colorSet.add(color);
        
        if (!modelColorMap[modelName]) {
          modelColorMap[modelName] = {};
        }
        
        if (!modelColorMap[modelName][color]) {
          modelColorMap[modelName][color] = 0;
        }
        
        modelColorMap[modelName][color]++;
      }
    });

    // Get all unique colors sorted
    this.allColors = Array.from(colorSet).sort();
    
    // Get all models
    const modelNames = Object.keys(modelColorMap).sort();

    // Build chart data
    const colorDatasets = this.allColors.map(color => {
      const data = modelNames.map(modelName => {
        return modelColorMap[modelName][color] || 0;
      });

      return {
        label: color,
        data: data,
        backgroundColor: this.getColorHex(color),
        borderColor: this.getColorHex(color),
        borderWidth: 1
      };
    });

    this.barChartData = {
      labels: modelNames,
      datasets: colorDatasets
    };

    // Build table data
    this.tableData = modelNames.map(modelName => {
      const colorCounts: { [color: string]: number } = {};
      let total = 0;

      this.allColors.forEach(color => {
        const count = modelColorMap[modelName][color] || 0;
        colorCounts[color] = count;
        total += count;
      });

      return {
        modelName: modelName,
        icon: this.getModelIcon(modelName),
        colors: colorCounts,
        total: total
      };
    });

    this.tableDataSource.data = this.tableData;
  }

  private updateDashboardData(data: DashboardResponse): void {
    // Update summary
    this.summary = { ...data.summary };
    
    // Transform chart data for stacked bar chart
    this.transformChartData(data.chartData.unitsByModel);
    
    // Build table data
    this.buildTableData(data.chartData.unitsByModel);
  }

  private transformChartData(chartData: StatisticsChartData): void {
    if (!chartData || !chartData.labels || !chartData.datasets) {
      return;
    }

    // Extract all unique colors from datasets
    const colorSet = new Set<string>();
    chartData.datasets.forEach(dataset => {
      if (dataset.label) {
        colorSet.add(dataset.label);
      }
    });
    this.allColors = Array.from(colorSet).sort();

    // Map model names to their index
    const modelLabels = chartData.labels;
    
    // Create a dataset for each color
    const colorDatasets = this.allColors.map(color => {
      const data = modelLabels.map((model, modelIndex) => {
        // Find the dataset for this color
        const colorDataset = chartData.datasets.find(d => d.label === color);
        if (colorDataset && colorDataset.data && colorDataset.data[modelIndex] !== undefined) {
          return colorDataset.data[modelIndex];
        }
        return 0;
      });

      // Get background color for this color
      const colorDataset = chartData.datasets.find(d => d.label === color);
      const bgColor = colorDataset?.backgroundColor?.[0] || this.getColorHex(color);

      return {
        label: color,
        data: data,
        backgroundColor: bgColor,
        borderColor: bgColor,
        borderWidth: 1
      };
    });

    this.barChartData = {
      labels: modelLabels,
      datasets: colorDatasets
    };
  }

  private buildTableData(chartData: StatisticsChartData): void {
    if (!chartData || !chartData.labels || !chartData.datasets) {
      return;
    }

    this.tableData = chartData.labels.map((modelName, modelIndex) => {
      const colorCounts: { [color: string]: number } = {};
      let total = 0;

      // Get counts for each color for this model
      chartData.datasets.forEach(dataset => {
        if (dataset.label && dataset.data && dataset.data[modelIndex] !== undefined) {
          const count = dataset.data[modelIndex];
          colorCounts[dataset.label] = count;
          total += count;
        }
      });

      // Ensure all colors are represented (set to 0 if not present)
      this.allColors.forEach(color => {
        if (!(color in colorCounts)) {
          colorCounts[color] = 0;
        }
      });

      return {
        modelName: modelName,
        icon: this.getModelIcon(modelName),
        colors: colorCounts,
        total: total
      };
    });
    
    this.tableDataSource.data = this.tableData;
  }

  private getColorHex(colorName: string): string {
    const normalizedColor = colorName.toUpperCase().trim();
    const colorMap: { [key: string]: string } = {
      'BLUE': '#2196F3',
      'GREEN': '#4CAF50',
      'GREEN ': '#4CAF50', // Handle trailing spaces
      'RED': '#F44336',
      'RED ': '#F44336',
      'WHITE': '#FFFFFF',
      'YELLOW': '#FFC107',
      'BLACK': '#000000',
      'ORANGE': '#FF9800',
      'PURPLE': '#9C27B0',
      'MNX': '#9E9E9E' // Handle special color codes
    };
    return colorMap[normalizedColor] || '#9E9E9E';
  }

  private getModelIcon(modelName: string): string {
    const normalizedModel = modelName.toLowerCase().trim();
    // Customize icons based on model names
    if (normalizedModel.includes('bajaj') || normalizedModel.includes('re')) {
      return 'two_wheeler'; // Three-wheeler icon
    }
    if (normalizedModel.includes('maxima')) {
      return 'two_wheeler'; // Three-wheeler icon
    }
    if (normalizedModel.includes('cargo')) {
      return 'local_shipping'; // Cargo vehicle icon
    }
    return 'directions_car'; // Default vehicle icon
  }

  getColorValue(modelData: any, color: string): number {
    return modelData.colors[color] || 0;
  }

  getDisplayedColumns(): string[] {
    const columns = ['model'];
    columns.push(...this.allColors.map(c => c.toLowerCase()));
    columns.push('total');
    return columns;
  }

  /**
   * Calculate model totals for today from units data
   */
  calculateModelTotalsToday(units: Units[]): void {
    const today = moment().startOf('day');
    const todayEnd = moment().endOf('day');
    
    // Filter units created today
    const todayUnits = units.filter(unit => {
      if (!unit.dateCreated) return false;
      const unitDate = moment(unit.dateCreated);
      return unitDate.isSameOrAfter(today) && unitDate.isSameOrBefore(todayEnd);
    });

    // Aggregate by model
    const modelTotalsMap: { [modelName: string]: number } = {};

    todayUnits.forEach(unit => {
      if (unit.model) {
        const modelName = unit.model.modelName?.trim() || 'Unknown';
        if (!modelTotalsMap[modelName]) {
          modelTotalsMap[modelName] = 0;
        }
        modelTotalsMap[modelName]++;
      }
    });

    // Convert to array and sort
    this.modelTotalsToday = Object.keys(modelTotalsMap)
      .map(modelName => ({
        modelName: modelName,
        total: modelTotalsMap[modelName],
        icon: this.getModelIcon(modelName)
      }))
      .sort((a, b) => b.total - a.total); // Sort by total descending
  }

  /**
   * Calculate model totals for today from chart data
   */
  calculateModelTotalsFromChartData(chartData: StatisticsChartData): void {
    if (!chartData || !chartData.labels || !chartData.datasets) {
      this.modelTotalsToday = [];
      return;
    }

    // The chart data from today's dashboard should already be filtered for today
    // So we can use it directly
    this.modelTotalsToday = chartData.labels.map((modelName, modelIndex) => {
      let total = 0;
      
      // Sum all colors for this model
      chartData.datasets.forEach(dataset => {
        if (dataset.data && dataset.data[modelIndex] !== undefined) {
          total += dataset.data[modelIndex];
        }
      });

      return {
        modelName: modelName,
        total: total,
        icon: this.getModelIcon(modelName)
      };
    }).filter(item => item.total > 0) // Only show models with units
      .sort((a, b) => b.total - a.total); // Sort by total descending
  }
}
