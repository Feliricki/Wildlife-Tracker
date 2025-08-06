import { Component, Inject, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_SNACK_BAR_DATA, MatSnackBarAction, MatSnackBarLabel, MatSnackBarRef } from "@angular/material/snack-bar";

@Component({
  selector: "app-google-maps-snackbar",
  template:
    `<span class="snackbar-label" matSnackBarLabel>
      {{data}}
    </span>
    <span class="dense-2" id="button-container" matSnackBarActions>
      <button mat-button matSnackBarAction (click)="snackBarRef.dismissWithAction()">Dismiss</button>
    </span>`,

  styles: [`
    :host {
      display: flex;
    }
    .snackbar-label {
      /* background-color: white; */
      /* color: white; */
    }
    span {
      /* color: white; */
    }

    #button-container {
      margin-top: 0.5em;
    }
  `],
  standalone: true,
  imports: [MatButtonModule, MatSnackBarLabel, MatSnackBarAction, MatSnackBarAction]
})
export class SnackbarComponent {
  snackBarRef = inject(MatSnackBarRef);
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: string) { }
}
