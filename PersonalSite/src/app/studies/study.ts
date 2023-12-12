// TODO: Make most of these fields optional
// consider using a helper type to make fields
// undefined or required based on where this
// interface is being used.
export interface StudyDTO {
  readonly acknowledgements: string;
  readonly citation: string;
  readonly grantsUsed: string;

  readonly id: bigint;
  readonly licenseType: string;
  readonly mainLocationLat?: number;
  readonly mainLocationLon?: number;
  readonly name: string;

  readonly numberOfDeployments: number;
  readonly numberOfIndividuals: number;
  readonly numberOfTags: number;

  readonly studyObjective: string;

  readonly timestampFirstDeployedLocation?: Date;
  readonly timestampLastDeployedLocation?: Date;
  readonly numberOfDeployedLocations: number;

  readonly taxonIds?: string;
  readonly sensorTypeIds?: string;

  readonly contactPersonName: string;
}
