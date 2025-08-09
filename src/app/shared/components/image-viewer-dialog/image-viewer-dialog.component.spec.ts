import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageViewerDialogComponent } from './image-viewer-dialog.component';

describe('ImageViewerDialogComponent', () => {
  let component: ImageViewerDialogComponent;
  let fixture: ComponentFixture<ImageViewerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImageViewerDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageViewerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
