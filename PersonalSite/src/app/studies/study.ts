export interface StudyDTO {
  acknowledgements: string;
  citation: string;
  grantsUsed: string;

  id: bigint;
  licenseType: string;
  mainLocationLat?: number;
  mainLocationLong?: number;
  name: string;

  numberOfDeployments: number;
  numberOfIndividuals: number;
  numberOfTags: number;

  studyObjective: string;

  timestampFirstDeployedLocation?: Date;
  timestampLastDeployedLocation?: Date;
  numberOfDeployedLocations: number;

  // TODO: make this an array here and in the backend too
  taxonIds?: string;
  sensorTypeIds?: string;

  contactPersonName: string;
}
