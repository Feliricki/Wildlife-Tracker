import { Color } from '@deck.gl/core/typed';
import * as GeoJSON from "geojson";
import { BinaryAttribute } from '@loaders.gl/schema';
import { EventRequest } from '../studies/EventRequest';

// #region Animal Movement Data Types

/**
 * Properties for animal movement events between two tracking points.
 * Contains temporal, spatial, and descriptive information about movement.
 */
export interface AnimalMovementEvent {
  sourceTimestamp: bigint | number;
  destinationTimestamp: bigint | number;
  content: string;
  distanceKm: number;
  distanceTravelledKm: number;
}

// Alias for backward compatibility during migration
export type EventProperties = AnimalMovementEvent;

// Strongly-typed GeoJSON feature types for animal tracking data
export type AnimalMovementLineFeature<TProps = AnimalMovementEvent> = GeoJSON.Feature<GeoJSON.LineString, TProps>;
export type AnimalLocationPointFeature<TProps> = GeoJSON.Feature<GeoJSON.Point, TProps>;
export type AnimalMovementLineCollection<TProps = AnimalMovementEvent> = GeoJSON.FeatureCollection<GeoJSON.LineString, TProps>;
export type AnimalLocationPointCollection<TProps> = GeoJSON.FeatureCollection<GeoJSON.Point, TProps>;

// Legacy aliases for backward compatibility
export type MovementTrackFeature<TProps = AnimalMovementEvent> = AnimalMovementLineFeature<TProps>;
export type StudyLocationFeature<TProps> = AnimalLocationPointFeature<TProps>;
export type MovementTrackCollection<TProps = AnimalMovementEvent> = AnimalMovementLineCollection<TProps>;
export type StudyLocationCollection<TProps> = AnimalLocationPointCollection<TProps>;
export type LineStringFeature<TProp> = AnimalMovementLineFeature<TProp>;
export type PointFeature<TProp> = AnimalLocationPointFeature<TProp>;
export type LineStringFeatureCollection<TProp> = AnimalMovementLineCollection<TProp>;
export type PointFeatureCollection<TProp> = AnimalLocationPointCollection<TProp>;

/**
 * Collection of animal movement line features with processing metadata.
 */
export type AnimalMovementLineBundle<TProps = AnimalMovementEvent> = {
  features: AnimalMovementLineFeature<TProps>[];
  individualLocalIdentifier?: string;
  index?: number;
  count?: number;
}

// Legacy aliases for backward compatibility
export type MovementTrackBundle<TProps = AnimalMovementEvent> = AnimalMovementLineBundle<TProps>;
export type LineStringFeatures<TProp> = AnimalMovementLineBundle<TProp>;

/**
 * Utility type for extracting non-numeric properties from a type.
 */
export type NonNumericProps<T> = {
  [K in keyof T]: T[K] extends number | bigint ? never : T[K];
};

/**
 * Utility type for extracting numeric properties from a type and converting them to BinaryAttribute.
 */
export type NumericPropsType<T> = {
  [K in keyof T]: T[K] extends number | bigint ? BinaryAttribute : never;
};

/**
 * Response type for numeric properties after binary processing.
 */
export type NumericPropsResponse<T> = ToBufferAttributes<T>;

// #endregion

// #region Binary Data Processing & Web Worker Types

/**
 * Wrapper for binary data arrays with size metadata.
 */
export interface BinaryDataBuffer {
  size: number;
  value: ArrayBufferLike;
}

/**
 * Container for tooltip content stored as binary buffers.
 */
export interface TooltipContentBuffers {
  contentArray: ArrayBufferLike[];
}

/**
 * Converts numeric/bigint properties of type T into BinaryDataBuffer format.
 * Used for efficient binary serialization of movement data.
 */
export type BinaryAttributeMap<T> = {
  [Property in keyof T]: T[Property] extends number | bigint ? BinaryDataBuffer : never;
};

/**
 * Binary format response from web worker containing processed animal movement line data.
 * Optimized for efficient rendering with deck.gl layers.
 */
export interface BinaryAnimalMovementLineResponse<TProps = AnimalMovementEvent> {
  type: "BinaryLineString" | "AggregatedEvents";
  index: number;
  length: number;
  individualLocalIdentifier: string;
  featureId: BinaryDataBuffer;
  globalFeatureIds: BinaryDataBuffer;
  pathIndices: BinaryDataBuffer;
  position: BinaryDataBuffer;
  numericProps: BinaryAttributeMap<TProps>;
  colors: BinaryDataBuffer;
  content: TooltipContentBuffers;
}

/**
 * Additional rendering attributes combined with deck.gl's BinaryLineFeatures.
 */
export interface DeckGlRenderingAttributes {
  length: number;
  content: TooltipContentBuffers;
  colors: BinaryAttribute;
  individualLocalIdentifier: string;
}

/**
 * Web worker request to fetch and process animal movement data.
 */
export interface MovementDataFetchRequest {
  readonly type: "FetchRequest";
  request: EventRequest;
}

// Legacy aliases for backward compatibility
export type BufferAttribute = BinaryDataBuffer;
export type ContentBufferArrays = TooltipContentBuffers;
export type ToBufferAttributes<T> = BinaryAttributeMap<T>;
export type BinaryMovementTrackResponse<T> = BinaryAnimalMovementLineResponse<T>;
export type BinaryLineStringResponse<T> = BinaryAnimalMovementLineResponse<T>;
export type OptionalDeckGlAttributes = DeckGlRenderingAttributes;
export type WorkerFetchRequest = MovementDataFetchRequest;

// #endregion
