import { Component, EventEmitter } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { SpinnerVisibilityService } from 'ng-http-loader';
import { ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { WebcamImage } from 'ngx-webcam';
import { Observable, Subject } from 'rxjs';

@Component({
  selector: 'app-image-upload-dialog',
  templateUrl: './image-upload-dialog.component.html',
  styleUrls: ['./image-upload-dialog.component.scss']
})
export class ImageUploadDialogComponent {
  imageSource;
  croppedImage: ImageCroppedEvent;
  imageChangedEvent;
  timeOuts = [];
  doneSelect = new EventEmitter<ImageCroppedEvent>();
  showCropper = false;
  showWebCam = false;

  private trigger: Subject<any> = new Subject();
  public webcamImage!: WebcamImage;
  private nextWebcam: Subject<any> = new Subject();
  constructor(
    private sanitizer: DomSanitizer,
    private spinner: SpinnerVisibilityService,
    public dialogRef: MatDialogRef<ImageUploadDialogComponent>) {

      window.addEventListener('resize', ()=> {
        this.timeOuts.push(setTimeout(()=> {
          window.dispatchEvent(new Event('resize'));
          for (var i = 0; i < this.timeOuts.length; i++) {
            clearTimeout(this.timeOuts[i]);
          }
        }, 1000));

      });
  }
  fileChangeEvent(event: any): void {
      // this.imageChangedEvent = event;
      const file = event.target.files[0];
      this.imageSource = URL.createObjectURL(file);
      event.target.value = '';
  }
  imageCropped(event: ImageCroppedEvent) {
    this.croppedImage = event;
    // event.blob can be used to upload the cropped image
  }
  imageLoaded(image: LoadedImage) {
      // show cropper
      this.showCropper = true;
      this.timeOuts.push(setTimeout(()=> {
        document.querySelector(".image-upload-content").scrollTo(
          document.querySelector(".image-upload-content").clientWidth/2,
          document.querySelector(".image-upload-content").clientHeight/2);
          for (var i = 0; i < this.timeOuts.length; i++) {
            clearTimeout(this.timeOuts[i]);
          }
      }, 100))
      ;
  }
  cropperReady() {
      // cropper ready
  }
  loadImageFailed() {
      // show message
  }
  getSnapshot(): void {
    this.trigger.next(void 0);
  }

  switchCamera() {
    const switchButton: HTMLElement = document.querySelector(".camera-switch");
    if(switchButton) {
      switchButton.click();
    }
  }

  captureImg(webcamImage: WebcamImage): void {
    this.webcamImage = webcamImage;
    this.imageSource = webcamImage!.imageAsDataUrl;
    this.showCropper = true;
    this.showWebCam = false;
  }
  get invokeObservable(): Observable<any> {
    return this.trigger.asObservable();
  }
  get nextWebcamObservable(): Observable<any> {
    return this.nextWebcam.asObservable();
  }

  async doneSelection() {
    this.spinner.show();
    this.doneSelect.emit(this.croppedImage);
    this.spinner.hide();
  }
}
