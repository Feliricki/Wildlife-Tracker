import { NonEmptyArray } from "../HelperTypes/NonEmptyArray";
import { EventOptions } from "./EventOptions";

// INFO: These interfaces are used to make request to the backend.
// The request is split into the necessary and optional parts.
export interface EventRequest {
  studyId: bigint;
  localIdentifiers: NonEmptyArray<string>;
  sensorType?: string;
  geometryType?: "point" | "linestring";
  options: EventOptions;
}


// export interface EventOptions {
//   maxEventsPerIndividual: number;
//   timestampStart: bigint;
//   timestampEnd: bigint;
//   attributes: string;
//   eventProfile: string;
// }
