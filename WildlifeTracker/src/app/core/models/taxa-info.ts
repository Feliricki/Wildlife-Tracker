export interface TaxaInfo {
  taxonId: bigint;
  scientificName: string;
  commonName: string;
  formalName: boolean;
  rank: string;
  division: string;
  lineage: string;
  geneticCode: string;
  mitochondrialGeneticCode: string;
  submittable: boolean;
}
