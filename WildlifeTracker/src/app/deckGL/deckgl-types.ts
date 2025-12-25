import * as GeoJSON from "geojson";
import { EventRequest } from '../studies/EventRequest';
import  { TypedArray } from '@loaders.gl/schema';


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


export interface AnimalPointEvent {
  timestamp: bigint | number;
  location: [number, number];
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



export type BinaryAttribute = {value: TypedArray; size: number};
export type BinaryGeometryType = 'Point' | 'LineString' | 'Polygon';

type NumericProps = {[key: string]: BinaryAttribute};
type Properties = object[];

/**
 * Represent a single Geometry, similar to a GeoJSON Geometry
 */
export type BinaryGeometry = BinaryPointGeometry | BinaryLineGeometry | BinaryPolygonGeometry;

/** Binary point geometry: an array of positions */
export type BinaryPointGeometry = {
  type: 'Point';
  positions: BinaryAttribute;
};

/** Binary line geometry, array of positions and indices to the start of each line */
export type BinaryLineGeometry = {
  type: 'LineString';
  positions: BinaryAttribute;
  pathIndices: BinaryAttribute;
};

/** Binary polygon geometry, an array of positions to each primitite polygon and polygon */
export type BinaryPolygonGeometry = {
  type: 'Polygon';
  positions: BinaryAttribute;
  polygonIndices: BinaryAttribute;
  primitivePolygonIndices: BinaryAttribute;
  triangles?: BinaryAttribute;
};

/** Common properties for binary geometries */
export type BinaryProperties = {
  featureIds: BinaryAttribute;
  globalFeatureIds: BinaryAttribute;
  numericProps: NumericProps;
  properties: Properties;
  fields?: Properties;
};

/** Binary feature + binary attributes */
export type BinaryFeature = BinaryPointFeature | BinaryLineFeature | BinaryPolygonFeature;

export type BinaryPointFeature = BinaryPointGeometry & BinaryProperties;
export type BinaryLineFeature = BinaryLineGeometry & BinaryProperties;
export type BinaryPolygonFeature = BinaryPolygonGeometry & BinaryProperties;

/**
 * Represent a collection of Features, similar to a GeoJSON FeatureCollection
 */
export type BinaryFeatureCollection = {
  shape: 'binary-feature-collection';
  points?: BinaryPointFeature;
  lines?: BinaryLineFeature;
  polygons?: BinaryPolygonFeature;
}


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
