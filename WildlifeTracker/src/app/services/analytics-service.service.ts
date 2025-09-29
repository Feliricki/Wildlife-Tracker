import { Injectable } from '@angular/core';

declare const gtag: (...arg: unknown[]) => void;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsServiceService {

  trackEvent(eventName: string, eventDetails: string, eventCategory: string) {
    gtag('event', eventName, {
      // event Type - example: 'SCROLL_TO_TOP_CLICKED'
      'event_category': eventCategory,
      // the label that will show up in the dashboard as the events name
      'event_label': eventName,
      // a short description of what happened
      'value': eventDetails
    });
  }

}
