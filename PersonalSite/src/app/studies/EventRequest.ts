import { NonEmptyArray } from "../HelperTypes/NonEmptyArray";
import { EventOptions } from "./EventOptions";

// INFO: These interfaces are used to make request to the backend.
// The request is split into the necessary and optional parts.
export interface EventRequest {
  StudyId: bigint;
  LocalIdentifiers?: NonEmptyArray<string>;
  SensorType?: string;
  GeometryType?: "point" | "linestring";
  Options: EventOptions;
}

// export interface EventOptions {
//   maxEventsPerIndividual: number;
//   timestampStart: bigint;
//   timestampEnd: bigint;
//   attributes: string;
//   eventProfile: string;
// }
