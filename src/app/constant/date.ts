import { MatDateFormats } from "@angular/material/core";

export const APP_DATE_FORMATS: MatDateFormats = {
    parse: {
     dateInput: { month: 'short', year: 'numeric', day: 'numeric' },
   },
   display: {
     dateInput: 'input',
     monthYearLabel: { year: 'numeric', month: 'numeric' },
     dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric'
     },
     monthYearA11yLabel: { year: 'numeric', month: 'long' },
   }
 };


 export const DateConstant = {
  DATE_LANGUAGE: 'Asia/Manila',
};
