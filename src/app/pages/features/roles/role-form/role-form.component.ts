import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Roles } from 'src/app/model/roles.model';
import { AppConfigService } from 'src/app/services/app-config.service';

@Component({
  selector: 'app-role-form',
  templateUrl: './role-form.component.html',
  styleUrls: ['./role-form.component.scss']
})
export class RoleFormComponent {
  isNew = true;
  form: FormGroup;
  @Input() isReadOnly: any;
  constructor(
    private formBuilder: FormBuilder,
    private appconfig: AppConfigService,
  ) {
    this.form = this.formBuilder.group({
      name: ['',[Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]],
      accessPages: [this.appconfig.config.lookup.accessPages]});
  }

  public setFormValue(value: Roles) {
    this.isNew = false;
    if(this.form) {
      this.form.controls["name"].setValue(value.name);
      this.form.controls["accessPages"].setValue(value.accessPages);
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
