export type EventProfiles =
  null | "EURING_01" | "EURING_02" | "EURING_03" | "EURING_04";

export interface EventOptions {
  // studyId: bigint;
  // localIdentifiers: string[];
  // sensorType: string;
  // milliBetweenEvents?: string;
  MaxEventsPerIndividual?: number;
  // minKmBetweenEvents?: number;
  // maxDurationDays?: number;
  // coordinateTrailingDigits?: number;
  TimestampStart?: bigint;
  TimestampEnd?: bigint;
  Attributes?: string;
  EventProfile?: EventProfiles;
}
