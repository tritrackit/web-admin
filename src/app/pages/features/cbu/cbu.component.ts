import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
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
      this.unitService.getByAdvanceSearch({
        order: this.order,
        columnDef: this.filter,
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
