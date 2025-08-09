import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  host: {
    class: "component-wrapper"
  }
})
export class AuthComponent {
  constructor(private route: ActivatedRoute) {
  }
}
