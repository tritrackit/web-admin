import { Component, EventEmitter, Input, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import moment from 'moment';
import { APP_DATE_FORMATS } from 'src/app/constant/date';
import { ColumnDefinition } from 'src/app/shared/utility/table';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  providers: [
    {provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS}
  ]
})
export class DataTableComponent {
  @Input() columnDefs: ColumnDefinition[] = [];
  @Input() isLoading: any;
  @Input() dataSource = new MatTableDataSource<any>();
  @Input() pageIndex: number = 0;
  @Input() pageSize: number = 10;
  @Input() total = 0;
  @Input() defaultThumbnail;
  @ViewChild('paginator', {static: false}) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  @Output() pageChange = new EventEmitter();
  @Output() sortChange = new EventEmitter();
  @Output() filterChange = new EventEmitter();
  @Output() headerControlChange = new EventEmitter();
  @Output() controlMenuItemSelected = new EventEmitter();

  dateFromDefault = new Date();
  dateToDefault = new Date();
  constructor() {
  }

  get displayedColumns() {
    return this.columnDefs.map((def) => def.name);
  }

  ngOnChanges(changes: SimpleChanges) {
  }

  booleanHeaderControlValue(name: string, checkBoxType: "all" | "indeterminate") {
    if(checkBoxType === "all") {
      const all = this.dataSource.data.filter(x=>x[name] === true);
      if(all) {
        return all.length === this.dataSource.data.length;
      } else {
        return false;
      }
    } else  {
      const all = this.dataSource.data.filter(x=>x[name] === true);
      if(all) {
        return all.length !== this.dataSource.data.length ? this.dataSource.data.some(x=>x[name] === true) : false;
      } else {
        return false;
      }
    }
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.sort.sortChange.subscribe((event: MatSort)=> {
      const { active, direction } = event;
      this.sortChange.emit({ active, direction });
    });


  }

  filterTable() {
    const filter = this.columnDefs
    .filter((x: any)=>x.filter && !x.filterOptions.hide && !x.controls && (!x.name|| x.name !== ""))
    .map((x: any)=> { return {
      apiNotation: x.apiNotation,
      filter: x.filter,
      name: x.name,
      type: x.filterOptions && x.filterOptions.type ? x.filterOptions.type : "text"
    }});
    this.filterChange.emit(filter);
  }

  formatDateRange(from, to) {
    from = from && from !== "" ? moment(from).format("YYYY-MM-DD") : "";
    to = to && to !== "" ? moment(to).format("YYYY-MM-DD") : "";
    return `${from},${to}`;
  }

  booleanHeaderControlChange(name: string, value: boolean) {
    this.dataSource.data.forEach(x=> {
      if(x[name] !== undefined || x[name] !== null) {
        x[name] = value;
      }
    });
    if(name && name !== "") {
      this.headerControlChange.emit(this.dataSource.data);
    }
  }

  imageErrorHandler(event) {
    if(this.defaultThumbnail) {
      event.target.src = this.defaultThumbnail;
    } else {
      event.target.src = "../../../assets/img/thumbnail.png";
    }
  }

  getDisplayRange() {
    const start = (this.pageIndex * this.pageSize) + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.total);
    return { start, end };
  }

  previousPage() {
    if (!this.isFirstPage()) {
      this.pageIndex--;
      this.pageChange.emit({ pageIndex: this.pageIndex, pageSize: this.pageSize });
    }
  }

  nextPage() {
    if (!this.isLastPage()) {
      this.pageIndex++;
      this.pageChange.emit({ pageIndex: this.pageIndex, pageSize: this.pageSize });
    }
  }

  isFirstPage(): boolean {
    return this.pageIndex === 0;
  }

  isLastPage(): boolean {
    return (this.pageIndex + 1) * this.pageSize >= this.total;
  }

  
}
