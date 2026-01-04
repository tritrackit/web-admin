import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Roles } from 'src/app/model/roles.model';
import { AppConfigService } from 'src/app/services/app-config.service';

@Component({
  selector: 'app-role-form',
  templateUrl: './role-form.component.html',
  styleUrls: ['./role-form.component.scss']
})
export class RoleFormComponent implements OnInit, OnChanges {
  isNew = true;
  form: FormGroup;
  @Input() isReadOnly: boolean = false;
  @Input() roleData: Roles;
  
  constructor(
    private formBuilder: FormBuilder,
    private appconfig: AppConfigService,
  ) {
    this.form = this.formBuilder.group({
      name: ['',[Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]],
      accessPages: [this.appconfig.config.lookup.accessPages]
    });
  }

  ngOnInit() {
    // Don't disable form here - wait until data is loaded in setFormValue
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle roleData changes
    if (changes['roleData'] && changes['roleData'].currentValue) {
      this.setFormValue(changes['roleData'].currentValue);
    }
    // Handle isReadOnly changes
    if (changes['isReadOnly'] && this.form) {
      if (changes['isReadOnly'].currentValue) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    }
  }

  public setFormValue(value: Roles) {
    this.isNew = false;
    if(this.form) {
      // Set values first using setValue on individual controls
      // This works even if form is disabled, but we'll enable first to ensure UI updates
      const wasDisabled = this.form.disabled;
      if (wasDisabled) {
        this.form.enable({ emitEvent: false });
      }
      
      this.form.controls['name'].setValue(value.name || '', { emitEvent: false });
      this.form.controls['accessPages'].setValue(
        value.accessPages || this.appconfig.config.lookup.accessPages,
        { emitEvent: false }
      );
      
      // Update form validity
      this.form.updateValueAndValidity({ emitEvent: false });
      
      // Disable form AFTER setting values if readonly
      if (this.isReadOnly || wasDisabled) {
        this.form.disable({ emitEvent: false });
      }
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