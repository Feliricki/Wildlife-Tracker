import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    selector: 'app-suggestions',
    imports: [
        MatFormFieldModule, ReactiveFormsModule, MatButtonModule,
        MatInputModule
    ],
    templateUrl: './suggestions.component.html',
    styleUrl: './suggestions.component.css'
})
export class SuggestionsComponent {

  // TODO:Write up a custom validators for theses fields.
  // Needs a email validator.
  suggestionsForm = new FormGroup({
    email: new FormControl<string>("", { nonNullable: true, validators: Validators.email }),
    content: new FormControl<string>("", { nonNullable: true , validators: Validators.required }),
  });

  get Email(): FormControl<string> {
    return this.suggestionsForm.controls.email;
  }

  get Content(): FormControl<string> {
    return this.suggestionsForm.controls.content;
  }

  hasContentError(): boolean {
    return this.Content.hasError("emptyField");
  }

  hasEmailError() {
    return this.Email.hasError("email");
  }

  // hasError(): boolean {
  //   return this.suggestionsForm.invalid;
  // }

  onSubmit(): void {
  }
}
