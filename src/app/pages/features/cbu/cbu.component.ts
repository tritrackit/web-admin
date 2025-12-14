import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subject, takeUntil, distinctUntilChanged } from 'rxjs';
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

      // 🔥 Listen for RFID events ONLY when on CBU list page
      // If user is already on /cbu/register, RegisterCbuComponent will handle it
      console.log(`🔍 CBU List: Setting up data$ subscription`);
      
      this.unitService.data$
        .pipe(
          filter((d: any) => {
            const shouldProcess = !!d && d._instant && !d._handled;
            console.log(`🔍 CBU List: Filter check`, {
              hasData: !!d,
              isInstant: d?._instant,
              isHandled: d?._handled,
              shouldProcess: shouldProcess,
              rfid: d?.rfid
            });
            return shouldProcess;
          }), // ⚡ Only instant, unhandled events
          distinctUntilChanged((prev, curr) => {
            const isSame = prev?.rfid === curr?.rfid;
            console.log(`🔍 CBU List: distinctUntilChanged check`, {
              prevRfid: prev?.rfid,
              currRfid: curr?.rfid,
              isSame: isSame,
              willEmit: !isSame
            });
            return isSame;
          }), // ⚡ Prevent duplicate RFIDs
          takeUntil(this.destroy$)
        )
        .subscribe(data => {
          // 🔥 Check if already on register page - if so, don't navigate (RegisterCbuComponent handles it)
          const currentUrl = this.router.url;
          if (currentUrl.includes('/cbu/register')) {
            console.log('⏭️ CBU List: Already on register page, skipping navigation');
            return; // RegisterCbuComponent will handle form population
          }
          
          const navStart = Date.now();
          console.log('🚀 CBU List: Instant navigation triggered', `(latency: ${data._latency || 0}ms)`);
          
          // ⚡ INSTANT navigation - no delay, no toast
          // Mark as handled to prevent duplicate processing
          data._handled = true;
          
          this.router.navigate(['/cbu/register'], {
            queryParams: {
              rfid: data.rfid,
              scannerCode: data.scannerCode,
              locationId: data.location?.locationId,
              location: data.location?.name,
              instant: 'true', // ⚡ Critical flag
              urgent: data._urgent ? 'true' : undefined
            },
            skipLocationChange: false
          }).then(() => {
            const navTime = Date.now() - navStart;
            console.log(`⚡ Navigation completed in ${navTime}ms`);
            
            // 🔍 DEBUG: Clear data after navigation
            console.log(`🔍 CBU List: Clearing scanned data after navigation`, {
              rfid: data.rfid,
              navigationTime: navTime
            });
            
            // ⚡ Clear immediately after navigation
            setTimeout(() => {
              this.unitService.clearScannedData();
              console.log(`🔍 CBU List: Scanned data cleared`);
            }, 300);
          }).catch((error) => {
            console.error(`🔍 CBU List: Navigation failed`, error);
            // Still clear data even if navigation fails
            this.unitService.clearScannedData();
          });
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
