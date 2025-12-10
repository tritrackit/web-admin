import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { SpinnerVisibilityService } from 'ng-http-loader';
import { AppConfigService } from 'src/app/services/app-config.service';
import { LocationsService } from 'src/app/services/locations.service';
import { StorageService } from 'src/app/services/storage.service';
import { LocationsTableColumn } from 'src/app/shared/utility/table';
import { convertNotationToObject } from 'src/app/shared/utility/utility';

@Component({
  selector: 'app-locations',
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
  host: {
    class: "page-component"
  }
})
export class LocationsComponent {
  currentUserId:string;
  error:string;
  dataSource = new MatTableDataSource<any>();
  displayedColumns = [];
  isLoading = false;
  isProcessing = false;
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  order: any = { locationId: "DESC" };
  searchTerm: string = '';

  filter: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[] = [];

  // Remove the dialog template reference since we're not using it
  // @ViewChild('locationFormDialog') locationFormDialogTemp: TemplateRef<any>;
  
  constructor(
    private spinner: SpinnerVisibilityService,
    private locationService: LocationsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router) {
      this.dataSource = new MatTableDataSource([]);
      if(this.route.snapshot.data) {
        // ... existing code
      }
    }

  ngOnInit(): void {
    this.getLocationsPaginated();
  }

  ngAfterViewInit() {
  }

  filterChange(event: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[]) {
    this.filter = event;
    this.getLocationsPaginated();
  }

  // Add search method
  onSearch(): void {
    this.pageIndex = 0; // Reset to first page when searching
    this.getLocationsPaginated();
  }

  // Add clear search method
  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.getLocationsPaginated();
  }

  async pageChange(event: { pageIndex: number, pageSize: number }) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    await this.getLocationsPaginated();
  }

  async sortChange(event: { active: string, direction: string }) {
    const { active, direction } = event;
    const { apiNotation } = this.appConfig.config.tableColumns.locations.find(x=>x.name === active);
    this.order = convertNotationToObject(apiNotation, direction.toUpperCase());
    this.getLocationsPaginated()
  }

  getLocationsPaginated(){
    try{
      this.isLoading = true;
      this.spinner.show();

      const searchFilter = this.searchTerm ? [
        {
          apiNotation: "name",
          filter: this.searchTerm.trim(),
          name: "name",
          type: "text"
        },
      ] : [];

      this.locationService.getAdvanceSearch({
        order: this.order,
        columnDef: [
          ...this.filter,
          ...searchFilter,
        ],
        pageIndex: this.pageIndex, pageSize: this.pageSize
      })
      .subscribe(res => {
        this.isLoading = false;
        if(res.success){
          let data = res.data.results.map((d)=>{
            return {
              locationId: d.locationId,
              locationCode: d.locationCode,
              name: d.name,
              url: `/locations/${d.locationId}`,
            } as LocationsTableColumn
          });
          this.total = res.data.total;
          this.dataSource = new MatTableDataSource(data);
          this.spinner.hide();
        }
        else{
          this.error = Array.isArray(res.message) ? res.message[0] : res.message;
          this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
          this.spinner.hide();
        }
      }, async (err) => {
        this.error = Array.isArray(err.message) ? err.message[0] : err.message;
        this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
        this.isLoading = false;
        this.spinner.hide();
      });
    }
    catch(e){
      this.error = Array.isArray(e.message) ? e.message[0] : e.message;
      this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
      this.isLoading = false;
      this.spinner.hide();
    }
  }

  // Remove these methods since locations can't be created
  /*
  showAddDialog() {
    this.dialog.open(this.locationFormDialogTemp)
  }

  closeNewLocationsDialog() {
    this.dialog.closeAll();
  }

  saveNewLocations(formData) {
    // Show error message since locations are fixed
    this.snackBar.open('Locations are fixed and cannot be created.', 'close', {
      panelClass: ['style-error'],
    });
  }
  */
}