import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [NavBarComponent, RouterOutlet]
})
export class AppComponent {
  constructor() {
    return;
  }
  title = 'Animal tracker';
}
