import { Directive, ElementRef, HostListener, ViewContainerRef, OnInit } from '@angular/core';

@Directive({
  selector: '[appInfoWindow]',
  standalone: true,
})
export class InfoWindowDirective implements OnInit {

  @HostListener('keypress', ['$event'])
  onKeyPress(event: KeyboardEvent): void {
    const charCode = event.key.charCodeAt(0);
    console.log(`Pressed key ${charCode}`);
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    console.log(event);
    console.log('Clicked appInfoWindow element');
  }

  constructor(
    private elementRef: ElementRef,
    private viewContainerRef: ViewContainerRef) {

    const targetEl: HTMLElement = elementRef.nativeElement;
    console.log(targetEl.id);
    targetEl.innerText = "directive test";
  }

  ngOnInit(): void {
    return;
  }



}
