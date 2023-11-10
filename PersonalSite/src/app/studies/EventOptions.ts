export interface EventOptions {
  // studyId: bigint;
  // localIdentifiers: string[];
  // sensorType: string;
  // milliBetweenEvents?: string;
  maxEventsPerIndividual?: number;
  // minKmBetweenEvents?: number;
  // maxDurationDays?: number;
  // coordinateTrailingDigits?: number;
  timestampStart?: bigint;
  timestampEnd?: bigint;
  attributes?: string;
  eventProfiles?: string;
}
