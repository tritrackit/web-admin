import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { AppConfigService } from 'src/app/services/app-config.service';
import { ModelService } from 'src/app/services/model.service';
import { StorageService } from 'src/app/services/storage.service';
import { ModelTableColumn } from 'src/app/shared/utility/table';

@Component({
  selector: 'app-model',
  templateUrl: './model.component.html',
  styleUrl: './model.component.scss',
  host: {
    class: "page-component"
  }
})
export class ModelComponent implements OnInit, AfterViewInit {
  error: string;
  dataSource = new MatTableDataSource<ModelTableColumn>();
  displayedColumns = [];
  isLoading = false;
  isProcessing = false;
  pageIndex = 0;
  pageSize = 12;
  total = 0;
  filterKeywords = "";

  // pageAccess: Access = {
  //   view: true,
  //   modify: false,
  // };
  constructor(
    private modelService: ModelService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router) {
    this.dataSource = new MatTableDataSource([]);
  }

  drop(event: CdkDragDrop<ModelTableColumn[]>) {
    const currentData = this.dataSource.data;
    moveItemInArray(currentData, event.previousIndex, event.currentIndex);
    currentData.forEach((item, index) => (item.sequenceId = (index + 1).toString())); // Update sequenceId as string
    this.dataSource.data = [...currentData];

    const reordered = currentData.map((item) => ({
      modelId: item.modelId,
      sequenceId: item.sequenceId,
    }));

    this.isLoading = true;
    this.modelService.updateOrder(reordered).subscribe(res => {
      this.isLoading = false;
      if (res.success) {

      } else {
        this.error = typeof res?.message !== "string" && Array.isArray(res.message) ? res.message[0] : res.message;
        this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
        this.isLoading = false;
      }

    }, (error) => {
      this.isLoading = false;
      this.error = typeof error?.message !== "string" && Array.isArray(error?.message) ? error?.message[0] : error?.message;
      this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
      this.isLoading = false;
    });

  }

  ngOnInit(): void {
    this.getPaginated();
  }

  ngAfterViewInit() {
  }

  async pageChange(event: { pageIndex: number, pageSize: number }) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    await this.getPaginated();
  }

  getPaginated() {
    try {
      this.isLoading = true;
      this.modelService.getAdvanceSearch({
        keywords: this.filterKeywords ,
        pageIndex: this.pageIndex,
        pageSize: this.pageSize
      })
        .subscribe(async res => {
          this.isLoading = false;
          if (res.success) {
            let data = res.data.results.map((d) => {
              return {
                modelId: d.modelId,
                sequenceId: d.sequenceId,
                modelName: d.modelName,
                description: d.description,
                unitCount: d.unitCount,
                thumbnailUrl: d.thumbnailFile?.secureUrl,
                url: `/model/${d.modelId}`,
              } as ModelTableColumn
            });
            this.total = res.data.total;
            this.dataSource = new MatTableDataSource(data);
          }
          else {
            this.error = typeof res?.message !== "string" && Array.isArray(res.message) ? res.message[0] : res.message;
            this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
            this.isLoading = false;
          }
        }, async (err) => {
          this.error = Array.isArray(err.message) ? err.message[0] : err.message;
          this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
          this.isLoading = false;
        });
    }
    catch (e) {
      this.error = Array.isArray(e.message) ? e.message[0] : e.message;
      this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
    }

  }

  onPageChange(event: any) {
    const {
      previousPageIndex,
      pageIndex,
      pageSize,
      length
    } = event;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
    this.getPaginated();
  }

  getStartRecord(): number {
    return (this.pageIndex * this.pageSize) + 1;
  }

  getEndRecord(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.total);
  }

  isFirstPage(): boolean {
    return this.pageIndex === 0;
  }

  isLastPage(): boolean {
    return (this.pageIndex + 1) * this.pageSize >= this.total;
  }

  goToPreviousPage(): void {
    if (!this.isFirstPage()) {
      this.pageIndex--;
      this.getPaginated();
    }
  }

  goToNextPage(): void {
    if (!this.isLastPage()) {
      this.pageIndex++;
      this.getPaginated();
    }
  }

  // Add search method
  onSearch(): void {
    this.pageIndex = 0; // Reset to first page when searching
    this.getPaginated();
  }

  // Add clear search method
  clearSearch(): void {
    this.filterKeywords = '';
    this.pageIndex = 0;
    this.getPaginated();
  }

  pictureErrorHandler(event) {
    event.target.src = this.getDeafaultPicture();
  }

  getDeafaultPicture() {
    return '../../../../assets/img/thumbnail-model.png';
  }
}
