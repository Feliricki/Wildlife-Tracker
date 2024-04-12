import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-reference',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './reference.component.html',
  styleUrl: './reference.component.css'
})
export class ReferenceComponent {
  constructor(){
  }

  currentYear(): number {
    return new Date().getFullYear();
  }

  currentDate(): Date {
    return new Date();
  }
}
