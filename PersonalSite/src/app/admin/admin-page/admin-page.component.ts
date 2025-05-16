import { Component, WritableSignal, inject, signal } from '@angular/core';
import { AdminService } from '../admin.service';
import { UpdateStudiesResult } from '../models/update-studies';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { timeout } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from 'src/app/base-maps/snackbar.component';

@Component({
    selector: 'app-admin-page',
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule
    ],
    templateUrl: './admin-page.component.html',
    styleUrl: './admin-page.component.css'
})
export class AdminPageComponent {

    constructor(private adminService: AdminService) { }

    updateResult: WritableSignal<UpdateStudiesResult | null> = signal(null);
    loadingState: WritableSignal<"loading" | "standby" | "error"> = signal("standby");


    private _snackBar = inject(MatSnackBar);

    updateStudies() {

        this.loadingState.set("loading");
        this.adminService.updateStudies().pipe(
            timeout(60 * 60 * 2) // two minutes
        )
            .subscribe({
                next: result => {
                    this.updateResult.set(result);
                },
                error: error => {
                    console.error(error);
                    this.loadingState.set("error");
                },
                complete: () => {
                    this.loadingState.set("standby");
                }
            });
    }

    openSnackBar(message: string, timeLimit: number = 2) {
        this._snackBar.openFromComponent(SnackbarComponent, { duration: timeLimit * 2000, data: message });
    }
}
