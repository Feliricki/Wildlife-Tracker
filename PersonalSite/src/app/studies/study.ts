export interface StudyDTO {
  acknowledgements: string;
  citation: string;
  grantsUsed: string;

  id: bigint;
  licenseType: string;
  mainLocationLat?: number;
  mainLocationLon?: number;
  name: string;

  numberOfDeployments: number;
  numberOfIndividuals: number;
  numberOfTags: number;

  studyObjective: string;

  timestampFirstDeployedLocation?: Date;
  timestampLastDeployedLocation?: Date;
  numberOfDeployedLocations: number;

  taxonIds?: string;
  sensorTypeIds?: string;

  contactPersonName: string;
}
