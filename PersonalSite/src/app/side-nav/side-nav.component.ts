import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css']
})
export class SideNavComponent {
  fixedInViewPort: boolean = true;
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  constructor() { }
}
