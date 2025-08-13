import { Component, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { SpinnerVisibilityService } from 'ng-http-loader';
import { AppConfigService } from 'src/app/services/app-config.service';
import { LocationsService } from 'src/app/services/locations.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
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

  filter: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[] = [];

  @ViewChild('locationFormDialog') locationFormDialogTemp: TemplateRef<any>;
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
        // this.pageLocations = {
        //   ...this.pageLocations,
        //   ...this.route.snapshot.data["location"]
        // };
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
      this.locationService.getAdvanceSearch({
        order: this.order,
        columnDef: this.filter,
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

  showAddDialog() {
    this.dialog.open(this.locationFormDialogTemp)
  }

  closeNewLocationsDialog() {
    this.dialog.closeAll();
  }

  saveNewLocations(formData) {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Save location?';
    dialogData.confirmButton = {
      visible: true,
      text: 'yes',
      color: 'primary',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'cancel',
    };
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(async (data: any) => {
      this.isProcessing = true;
      dialogRef.componentInstance.isProcessing = this.isProcessing;
      try {
        let res = await this.locationService.create(formData).toPromise();
        if (res.success) {
          this.snackBar.open(res.message, 'close', {
            panelClass: ['style-success'],
          });
          this.dialog.closeAll();
          this.router.navigate(['/locations/' + res.data.locationId]);
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
        } else {
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = Array.isArray(res.message)
            ? res.message[0]
            : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          dialogRef.close();
        }
      } catch (e) {
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;
        this.error = Array.isArray(e.message) ? e.message[0] : e.message;
        this.snackBar.open(this.error, 'close', {
          panelClass: ['style-error'],
        });
        dialogRef.close();
      }
    });
  }
}
