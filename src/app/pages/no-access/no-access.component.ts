import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-no-access',
  templateUrl: './no-access.component.html',
  styleUrls: ['./no-access.component.scss']
})
export class NoAccessComponent {
  url = "";
  page = "";
  host = `${window.location.protocol}//${window.location.hostname}`;
  constructor() {
    this.url = window.history.state["no-access-url"];
    this.page = window.history.state["no-access-page"];
  }
}
