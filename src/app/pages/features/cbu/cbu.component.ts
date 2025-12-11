import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { StorageService } from 'src/app/services/storage.service';
import { UnitService } from 'src/app/services/unit.service';
import { CBUTableColumn } from 'src/app/shared/utility/table';
import { convertNotationToObject } from 'src/app/shared/utility/utility';

@Component({
  selector: 'app-cbu',
  templateUrl: './cbu.component.html',
  styleUrl: './cbu.component.scss',
  host: {
    class: "page-component"
  }
})
export class CBUComponent {
  error:string;
  dataSource = new MatTableDataSource<any>();
  displayedColumns = [];
  isLoading = false;
  isProcessing = false;
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  order: any = { unitCode: "DESC" };
  searchTerm: string = '';

  filter: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[] = [];

  // pageAccess: Access = {
  //   view: true,
  //   modify: false,
  // };
  private destroy$ = new Subject<void>();
  constructor(
    private unitService: UnitService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router) {
      this.dataSource = new MatTableDataSource([]);
      if(this.route.snapshot.data) {
      }

      this.unitService.data$
        .pipe(
          filter((d: any) => !!d),   // ignore null clears
          takeUntil(this.destroy$)
        ).subscribe(data => {
        if(data?.rfid && data?.location?.locationId){
          const isUrgent = data._urgent === true; // ✅ Check urgent flag
          
          // Show immediate notification with urgent indicator
          this.snackBar.open(
            `${isUrgent ? '⚡ URGENT: ' : ''}RFID Detected: ${data.rfid}${data._latency ? ` (${data._latency}ms)` : ''}`, 
            'Opening Registration...', 
            {
              duration: isUrgent ? 1000 : 2000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: isUrgent ? ['urgent-toast'] : ['success-toast']
            }
          );
          
          // Navigate immediately (navigation is intentional for full form)
          router.navigate([`/cbu/add`], {
            queryParams: { 
              rfid: data.rfid,
              scannerCode: data.scannerCode,
              locationId: data.location?.locationId,
              urgent: isUrgent ? 'true' : undefined // ✅ Pass urgent flag
            }
          });
          
          // Clear the data after navigation
          this.unitService.clearScannedData();
        }
      });
    }

  ngOnInit(): void {
    this.getAccessPaginated();
    this.unitService.refresh$
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      this.getAccessPaginated(); // Reload the data
    });
  }

  ngAfterViewInit() {

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filterChange(event: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[]) {
    this.filter = event;
    this.getAccessPaginated();
  }

  // Add search method
  onSearch(): void {
    this.pageIndex = 0; // Reset to first page when searching
    this.getAccessPaginated();
  }

  // Add clear search method
  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.getAccessPaginated();
  }

  async pageChange(event: { pageIndex: number, pageSize: number }) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    await this.getAccessPaginated();
  }

  async sortChange(event: { active: string, direction: string }) {
    const { active, direction } = event;
    const { apiNotation } = this.appConfig.config.tableColumns.cbu.find(x=>x.name === active);
    this.order = convertNotationToObject(apiNotation, direction.toUpperCase());
    this.getAccessPaginated()
  }

  getAccessPaginated(){
    try{
      this.isLoading = true;

      const searchFilter = this.searchTerm ? [
        {
          apiNotation: "chassisNo",
          filter: this.searchTerm.trim(),
          name: "chassisNo",
          type: "text"
        },
      ] : [];

      this.unitService.getByAdvanceSearch({
        order: this.order,
        columnDef: [
          ...this.filter,
          ...searchFilter,
        ],
        pageIndex: this.pageIndex, pageSize: this.pageSize
      })
      .subscribe(async res => {
        if(res.success){
          let data = res.data.results.map((d)=>{
            return {
              unitId: d.unitId,
              unitCode: d.unitCode,
              chassisNo: d.chassisNo,
              model: d.model?.modelName,
              color: d.color,
              location: d.location?.name,
              status: d.status?.name,
              url: `/cbu/${d.unitCode}`,
            } as CBUTableColumn
          });
          this.total = res.data.total;
          this.dataSource = new MatTableDataSource(data);
          this.isLoading = false;
        }
        else{
          this.error = Array.isArray(res.message) ? res.message[0] : res.message;
          this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
          this.isLoading = false;
        }
      }, async (err) => {
        this.error = Array.isArray(err.message) ? err.message[0] : err.message;
        this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
        this.isLoading = false;
      });
    }
    catch(e){
      this.error = Array.isArray(e.message) ? e.message[0] : e.message;
      this.snackBar.open(this.error, 'close', {panelClass: ['style-error']});
      this.isLoading = false;
    }

  }
}
