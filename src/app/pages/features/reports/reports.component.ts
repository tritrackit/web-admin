import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfViewerComponent } from 'ng2-pdf-viewer';
import { debounce, debounceTime, from } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { LoaderService } from 'src/app/services/loader.service';
import { StorageService } from 'src/app/services/storage.service';
import moment from 'moment';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  host: {
    class: "page-component"
  }
})
export class ReportsComponent {
  pdfUrl: string | ArrayBuffer | null = null;
  pdfBlob: Blob | null = null; // 👈 Add this property
  pdfViewerKey = 0; // trigger change detection

  isLoading = false;
  isProcessing = false;
  reportParamForm: FormGroup = new FormGroup({
    type: new FormControl("ALL", [Validators.required]),
    roomCode: new FormControl(null, [Validators.required]),
    startDate: new FormControl(new Date().toISOString(), [Validators.required]),
    endDate: new FormControl(null),
  });


  @ViewChild('pdfViewer') pdfViewer: PdfViewerComponent;
  constructor(
    private loaderService: LoaderService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    public router: Router,) {
  }
  get f() {
    return this.reportParamForm.controls;
  }
  get formIsValid() {
    return this.reportParamForm.valid;
  }
  get formIsReady() {
    return this.reportParamForm.valid && this.reportParamForm.dirty;
  }
  get formData() {
    return this.reportParamForm.value;
  }

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
    this.reportParamForm.valueChanges.pipe(debounceTime(1000)).subscribe((value)=> {
      this.pdfUrl = null;
      this.pdfBlob = null;
      this.cdr.detectChanges();
      if(this.pdfViewer) {
        this.pdfViewer.clear();
      }
      if(!this.isLoading) {
        this.generateReport();
      }
    });
    this.reportParamForm.get("startDate").disable();
    this.reportParamForm.get("endDate").disable();
    this.reportParamForm.get("roomCode").valueChanges.subscribe((value) => {
      if (value) {
        this.reportParamForm.get("startDate").enable();
        this.reportParamForm.get("endDate").enable();
      } else {
        this.reportParamForm.get("startDate").disable();
        this.reportParamForm.get("endDate").disable();
      }
    });
  }
  filterRooms(search: any) {

    if (!search || search === "") {
      this.onRoomSelected({ option: { value: null } });
    }
  }

  displayFn(user: any): string {
    return user?.name || '';
  }

  onRoomSelected(event: any) {
    const selectedRoom = event.option.value;
    this.reportParamForm.get("roomCode").markAllAsTouched();
    this.reportParamForm.get("roomCode").markAsDirty();
    this.reportParamForm.get("roomCode").patchValue(selectedRoom ? selectedRoom.roomCode : null);
    this.cdr.detectChanges(); // Ensure dropdown updates
  }

  setType(value: "ALL" | "DOOR" | "LIGHTS" | "MAINTENANCE" | "OCCUPANCY") {

    if(this.formData.type !== value) {
      this.reportParamForm.get("type").patchValue(value);
      this.reportParamForm.get("type").markAllAsTouched();
      this.reportParamForm.get("type").markAsDirty();

      console.log(this.formData.type);
    }
  }


  generateReport() {
    if(!this.formIsReady || !this.formIsValid) {
      return;
    }
    const payload = this.formData;
  }

  printPDF() {
    if (!this.pdfBlob) return;
    const url = URL.createObjectURL(this.pdfBlob);
    const printWindow = window.open(url, '_blank');
    // Optional: Auto-trigger print once loaded
    printWindow?.addEventListener('load', () => {
      printWindow?.print();
    });
  }

  getError(key: string) {
    return this.f[key].touched || this.f[key].dirty ? this.f[key].errors : null;
  }
}
