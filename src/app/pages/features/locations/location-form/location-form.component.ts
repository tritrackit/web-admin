import { Component, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Locations } from 'src/app/model/locations.model';

@Component({
  selector: 'app-location-form',
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.scss'
})
export class LocationFormComponent {
  form: FormGroup;
  @Input() isReadOnly: any;
  constructor(
    private formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      locationCode: ['',[Validators.required, Validators.minLength(3), Validators.maxLength(15), Validators.pattern('^(?=.{1,15}$)([A-Z][A-Za-z0-9_-]*|[0-9][A-Za-z0-9_-]*)$')]],
      name: ['',[Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]],
    });
  }

  public setFormValue(value: Locations) {
    if(this.form) {
      this.form.controls["locationCode"].setValue(value.locationCode);
      this.form.controls["name"].setValue(value.name);
    }
  }

  public get getFormData() {
    return this.form.value;
  }

  public get valid() {
    return this.form.valid;
  }

  public get ready() {
    return this.form.valid && this.form.dirty;
  }

  getError(key: string) {
    return this.form.controls && this.form.controls[key] ? this.form.controls[key].errors : null;
  }
}
