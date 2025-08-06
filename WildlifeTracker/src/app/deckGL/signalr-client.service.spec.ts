import { TestBed } from '@angular/core/testing';

import { SignalrClientService } from './signalr-client.service';

describe('SignalrClientService', () => {
  let service: SignalrClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalrClientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
