import { Component, Input, OnInit, AfterViewInit, OnDestroy, forwardRef, SimpleChanges, OnChanges, Output, EventEmitter, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors, FormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';
import { debounceTime, filter, takeUntil, take } from 'rxjs/operators';
import { MatSelect } from '@angular/material/select';

@Component({
  selector: 'app-mat-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrls: ['./multi-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true
    }
  ]
})
export class MultiSelectComponent<T> implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor, Validator, OnChanges {
  @Input() options: Array<T> = [];
  @Input() key: keyof T = '' as keyof T;  // e.g., 'id'
  @Input() text: keyof T = '' as keyof T;  // e.g., 'name'
  @Input() tooltipMessage: string = "Select All / Unselect All";
  @Input() searchPlaceholder: string = "Search...";
  @Input("placeholder") selectPlaceholder: string = "Select multiple";

  public multiSelectCtrl = new FormControl<Array<T>>([]);  // Store array of objects (full objects)
  public multiFilterCtrl = new FormControl<string>('');  // For search functionality
  public filtered: Array<T> = [];  // Filtered options

  @ViewChild('multiSelect', { static: true }) multiSelect?: MatSelect;
  private _onDestroy = new Subject<void>();
  selectAllActive = false;
  selectedValue: Array<T> = [];  // Store selected objects

  compareFn = (o1: T, o2: T) => {
    return o1 && o2 ? o1[this.key] === o2[this.key] : o1 === o2
  };  // Compare by unique property

  // ControlValueAccessor methods
  onChange: any = () => {};
  onTouched: any = () => {};

  constructor() {}

  ngOnInit(): void {
    // Listen for search field value changes
    this.multiFilterCtrl.valueChanges.subscribe((search) => {
      this.filterOptions(search);  // Filter the options based on the search value
    });

    this.multiSelectCtrl.valueChanges.subscribe((data) => {
      if (data && data.length >= 1) {
        this.selectAllActive = this.options.length === data.length;
      } else {
        this.selectAllActive = false;
      }
      this.selectedValue = data as any[];
      this.onChange(this.selectedValue);  // Propagate the change
    });

    this.filtered = this.options;
  }

  // Write selected objects to the control
  writeValue(value: Array<T> = []): void {
    this.selectedValue = value;
    this.multiSelectCtrl.patchValue(this.selectedValue);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.multiSelectCtrl.disable();
    } else {
      this.multiSelectCtrl.enable();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this.selectedValue ? null : { required: true };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["options"] && !changes["options"].firstChange) {
      this.options = changes["options"].currentValue;
      this.filtered = this.options;
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  toggleSelectAll(selectAllValue: boolean): void {
    if (selectAllValue) {
      this.selectAllActive = true;
      // Patch with the ids of filtered items
      this.multiSelectCtrl.patchValue((this.filtered as any[]).map(item => item[this.key]));
    } else {
      this.selectAllActive = false;
      this.multiSelectCtrl.patchValue([]);
    }
  }
  /**
   * Filter the options based on the search term
   */
  private filterOptions(search: string | null): void {
    if (!search) {
      this.filtered = this.options;
    } else {
      this.filtered = this.options.filter(option =>
        (option[this.text] as string).toLowerCase().includes(search.toLowerCase())
      );
    }
  }
}
