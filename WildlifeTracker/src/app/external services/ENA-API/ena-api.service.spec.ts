import { TestBed } from '@angular/core/testing';

import { ENAAPIService } from './ena-api.service';

describe('ENAAPIService', () => {
  let service: ENAAPIService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ENAAPIService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
