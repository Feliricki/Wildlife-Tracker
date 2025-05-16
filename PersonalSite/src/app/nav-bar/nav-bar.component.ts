import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-nav-bar',
    templateUrl: './nav-bar.component.html',
    styleUrls: ['./nav-bar.component.css'],
    standalone: true,
    imports: [MatToolbarModule, MatButtonModule, RouterLink, MatIconModule]
})
export class NavBarComponent {

    constructor(private activatedRoute: ActivatedRoute) {

    }

    matchRoute(route: string): boolean {
        return this.activatedRoute.component !== null && this.activatedRoute.component !== undefined && this.activatedRoute.component.name === route;
    }
}
