// import {GoogleMapsOverlay } from '@deck.gl/google-maps/typed';
// import { MapboxOverlay } from '@deck.gl/mapbox/typed';
import { EventRequest } from "../studies/EventRequest";
import { BinaryAttribute } from '@loaders.gl/schema';
// import { LineStringFeatureCollection } from "./GeoJsonTypes";
// import { TypedArray } from '@loaders.gl/schema'


export interface WorkerFetchRequest {
  readonly type: "FetchRequest";
  request: EventRequest;
}

export type BufferAttribute = {
  size: number;
  value: ArrayBufferLike;
}

export type NonNumericProps<T> = {
  [Property in keyof T]: T[Property] extends number | bigint ? never : T[Property];
}

export type NumericProps<T> = {
  [Property in keyof T]: T[Property] extends number | bigint ? T[Property] : never;
}

export type NonNumericPropsResponse<T> = {
  [Property in keyof T]: T[Property] extends number | bigint ? never : BufferAttribute;
}

export type NumericPropsResponse<T> = {
  [Property in keyof T]: T[Property] extends number | bigint ? BufferAttribute : never;
}

export type ArrayBufferProps<T> = {
  [Property in keyof T]: ArrayBufferLike;
}

export type NumericPropsType<T> = {
  [Property in keyof T]: T[Property] extends bigint | number ? BinaryAttribute : never;
}

export interface BinaryLineStringResponse<TProp> {
  type: "BinaryLineString" | "AggregatedEvents";
  index: number;
  length: number;
  individualLocalIdentifier: string;
  featureId: BufferAttribute;
  globalFeatureIds: BufferAttribute;
  pathIndices: BufferAttribute;
  position: BufferAttribute;
  numericProps: NumericPropsResponse<TProp>;
  properties?: ArrayBufferProps<NonNumericProps<TProp>>;
  colors: BufferAttribute;
  content: ContentBufferArrays;
}

export type ContentBufferArrays = {
  contentArray: ArrayBufferLike[];
}

// These optional attributes get combined with the
// given BinaryLineFeatures which is fed into the createLayer methods.
export interface OptionalAttributes {
  length: number;
  content: ContentBufferArrays;
  colors: BinaryAttribute;
  individualLocalIdentifier: string;
  // TODO: add the local identifier.
}
