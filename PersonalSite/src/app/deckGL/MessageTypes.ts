// import {GoogleMapsOverlay } from '@deck.gl/google-maps/typed';
// import { MapboxOverlay } from '@deck.gl/mapbox/typed';
import { EventRequest } from "../studies/EventRequest";
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

export interface BinaryLineStringResponse {
  type: "BinaryLineString";
  index: number;
  length: number;
  featureId: BufferAttribute;
  globalFeatureIds: BufferAttribute;
  pathIndices: BufferAttribute;
  position: BufferAttribute;
  numericProps?: { distance: ArrayBufferLike, distanceTravelled: ArrayBufferLike, timestamp: ArrayBufferLike };
  content: ContentInfo;
}

export type ContentInfo = {
  contentArray: ArrayBufferLike[];
}

export interface OptionalAttributes {
  length: number;
  content: ContentInfo;
}
