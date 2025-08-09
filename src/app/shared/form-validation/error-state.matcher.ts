import { FormControl, FormGroupDirective, NgForm } from "@angular/forms";
import { ErrorStateMatcher } from "@angular/material/core";

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!((control?.invalid && control?.touched && control?.dirty) || (control?.invalid && control?.touched && control?.parent?.dirty) );
  }
}
