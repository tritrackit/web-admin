import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { AppConfigService } from 'src/app/services/app-config.service';
import { ScannerService } from 'src/app/services/scanner.service';
import { StorageService } from 'src/app/services/storage.service';
import { ScannerTableColumn } from 'src/app/shared/utility/table';
import { convertNotationToObject } from 'src/app/shared/utility/utility';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
  host: {
    class: "page-component"
  }
})
export class ScannerComponent {
  error:string;
  dataSource = new MatTableDataSource<any>();
  displayedColumns = [];
  isLoading = false;
  isProcessing = false;
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  order: any = { scannerCode: "DESC" };
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
  constructor(
    private scannerService: ScannerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router) {
      this.dataSource = new MatTableDataSource([]);
      if(this.route.snapshot.data) {
      }
    }

  ngOnInit(): void {
    this.getAccessPaginated();
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
    const { apiNotation } = this.appConfig.config.tableColumns.scanner.find(x=>x.name === active);
    this.order = convertNotationToObject(apiNotation, direction.toUpperCase());
    this.getAccessPaginated()
  }

  getAccessPaginated(){
    try{
      this.isLoading = true;

      const searchFilter = this.searchTerm ? [
        {
          apiNotation: "name",
          filter: this.searchTerm.trim(),
          name: "name",
          type: "text"
        },
      ] : [];

      this.scannerService.getByAdvanceSearch({
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
              scannerId: d.scannerId,
              scannerCode: d.scannerCode,
              name: d.name,
              scannerType: d.scannerType, 
              location: d.location?.name,
              assignedEmployeeUser: `${d.assignedEmployeeUser?.firstName} ${d.assignedEmployeeUser?.lastName}`,
              dateCreated: d.dateCreated,
              url: `/scanner/${d.scannerCode}`,
            } as ScannerTableColumn
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
