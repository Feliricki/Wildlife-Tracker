export interface TaxaSuggestion {
  taxId: bigint;
  scientificName: string;
  displayName: string;
}

export type SuggestionDTO = TaxaSuggestion[];

