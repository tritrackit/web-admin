import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import moment from 'moment';
import { Subscription, forkJoin } from 'rxjs';
import { ApiResponse } from 'src/app/model/api-response.model';
import { Model } from 'src/app/model/model.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { ModelService } from 'src/app/services/model.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { ImageUploadDialogComponent } from 'src/app/shared/components/image-upload-dialog/image-upload-dialog.component';
import { ImageViewerDialogComponent } from 'src/app/shared/components/image-viewer-dialog/image-viewer-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { getImageExtensionByDataURL } from 'src/app/shared/utility/utility';

@Component({
  selector: 'app-model-details',
  templateUrl: './model-details.component.html',
  styleUrl: './model-details.component.scss',
  host: {
    class: "page-component"
  }
})
export class ModelDetailsComponent implements OnInit {
  modelId;
  isNew = false;
  isReadOnly = true;
  error;
  isLoading = true;
  modelForm: FormGroup = new FormGroup({
    sequenceId: new FormControl(null, [Validators.required]),
    modelName: new FormControl(null, [Validators.required]),
    description: new FormControl(null, [ Validators.required]),
  }
);
  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  model: Model;
  modelThumbnailSource: any;
  modelThumbnail;
  modelThumbnailLoaded = false;

  constructor(
    private modelService: ModelService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    const { isNew, edit } = this.route.snapshot.data;
    this.isNew = isNew ? isNew : false;
    this.modelId = this.route.snapshot.paramMap.get('modelId');
    this.isReadOnly = !edit && !isNew;
    this.model = {
      thumbnailFile: {}
    } as any;
  }

  get pageRights() {
    let rights = {};
    // for(var right of this.pageAccess.rights) {
    //   rights[right] = this.pageAccess.modify;
    // }
    return rights;
  }

  get f() {
    return this.modelForm.controls;
  }
  get formIsValid() {
    return this.modelForm.valid;
  }
  get formIsReady() {
    return this.modelForm.valid && this.modelForm.dirty;
  }
  get formData() {
    const data = this.modelForm.value;
    data.sequenceId = data?.sequenceId?.toString();
    data.thumbnailFile = this.modelThumbnail;
    return data;
  }

  async ngOnInit(): Promise<void> {
    if(!this.isNew) {
      this.isLoading = true;
      await this.initDetails();
      this.isLoading = false;
    }
    this.isLoading = false;
  }

  async initDetails() {
    try {
      forkJoin([
        this.modelService.getByCode(this.modelId).toPromise(),
        this.modelService.getAdvanceSearch({
          keywords: "",
            order: {
              "name": "ASC"
            } as any,
          pageIndex: 0,
          pageSize: 10
      })
      ]).subscribe(([model])=> {
        if (model.success) {
          this.model = model.data;
          this.modelForm.patchValue({
            sequenceId: model.data.sequenceId,
            modelName: model.data.modelName,
            description: model.data.description
          });
          this.modelForm.updateValueAndValidity();
          if (this.isReadOnly) {
            this.modelForm.disable();
          }
          this.isLoading = false;
        } else {
          this.isLoading = false;
          this.error = Array.isArray(model.message) ? model.message[0] : model.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
        }
      });
    } catch(ex) {
      this.isLoading = false;
      this.error = Array.isArray(ex.message) ? ex.message[0] : ex.message;
      this.snackBar.open(this.error, 'close', {
        panelClass: ['style-error'],
      });
    }
  }

  getError(key: string) {
    return this.f[key].errors;
  }


  onSubmit() {
    if (this.modelForm.invalid) {
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Save user?';
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
        this.isProcessing = true;
        const params = this.formData;
        let res:ApiResponse<Model>;
        if(this.isNew) {
          res = await this.modelService.create(params).toPromise();
        } else {
          res = await this.modelService.update(this.modelId, params).toPromise();
        }
        this.isProcessing = false;

        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/model/' + res.data.modelId]);
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
        } else {
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = typeof res?.message !== "string" && Array.isArray(res?.message)
            ? res.message[0]
            : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          dialogRef.close();
          if(res?.message?.toString().toLowerCase().includes("name") && res?.message?.toString().toLowerCase().includes("already exist")) {
            this.modelForm.get("name").setErrors({
              exist: true
            })
          }
          if(res?.message?.toString().toLowerCase().includes("sequence") && res?.message?.toString().toLowerCase().includes("must be a number string")) {
            this.modelForm.get("sequenceId").setErrors({
              invalid: true
            })
          }
          if(res?.message?.toString().toLowerCase().includes("sequence") && res?.message?.toString().toLowerCase().includes("already exist")) {
            this.modelForm.get("sequenceId").setErrors({
              exist: true
            })
          }
        }
      } catch (e) {
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;
        this.error = typeof e.message !== "string" && Array.isArray(e.message) ? e.message[0] : e.message;
        this.snackBar.open(this.error, 'close', {
          panelClass: ['style-error'],
        });
        dialogRef.close();
      }
    });
  }

  onDeleteModel() {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Delete model';
    dialogData.message = 'Are you sure you want to delete this model?';
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
      try {

        const res = await this.modelService.delete(this.modelId).toPromise();
        if (res.success) {
          this.snackBar.open('model deleted!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/model/']);
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
        } else {
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = typeof res?.message !== "string" && Array.isArray(res.message)
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

  // In your model-details.component.ts
onShowChangeThumbnail() {
  const dialogRef = this.dialog.open(ImageUploadDialogComponent, {
    disableClose: true,
    panelClass: "image-upload-dialog"
  });
  dialogRef.componentInstance.showCropper = false;
  dialogRef.componentInstance.showWebCam = false;
  dialogRef.componentInstance.doneSelect.subscribe(res=> {
    this.modelThumbnailLoaded = false;
    this.model.thumbnailFile = {
      secureUrl: res.base64
    };
    this.modelForm.markAsDirty();
    this.modelForm.markAllAsTouched();
    dialogRef.close();

    const imageType = getImageExtensionByDataURL(res.base64.toString());
    
    // Ensure we have a proper data URI
    let dataUri = res.base64.toString();
    
    // If it's not a proper data URI, convert it
    if (!dataUri.startsWith('data:image/')) {
      dataUri = `data:image/${imageType};base64,${dataUri}`;
    }
    
    this.modelThumbnail = {
      fileName: `${moment().format("YYYY-MM-DD-hh-mm-ss")}.${imageType}`,
      data: dataUri // Make sure it's a proper data URI
    };

  })
}

  onShowImageViewer() {
    const dialogRef = this.dialog.open(ImageViewerDialogComponent, {
        disableClose: true,
        panelClass: "image-viewer-dialog"
    });
    const img: HTMLImageElement = document.querySelector(".thumbnail-pic img");
    dialogRef.componentInstance.imageSource = img?.src;
    dialogRef.componentInstance.canChange = false;

    dialogRef.componentInstance.changed.subscribe(res=> {
      this.modelThumbnailLoaded = false;
      this.modelThumbnailSource = res.base64;
      dialogRef.close();

      const imageType = getImageExtensionByDataURL(res.base64.toString());
      this.modelThumbnail = {
        fileName: `${moment().format("YYYY-MM-DD-hh-mm-ss")}.${imageType}`,
        data: res.base64.toString()
      };
    })
  }

  pictureErrorHandler(event) {
    event.target.src = this.getDeafaultPicture();
  }

  getDeafaultPicture() {
    return '../../../../../assets/img/thumbnail-model.png';
  }
}
