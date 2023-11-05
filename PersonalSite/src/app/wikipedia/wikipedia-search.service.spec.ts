import { TestBed } from '@angular/core/testing';

import { WikipediaSearchService } from './wikipedia-search.service';

describe('WikipediaSearchService', () => {
  let service: WikipediaSearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WikipediaSearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
