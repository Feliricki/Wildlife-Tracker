import { Color } from '@deck.gl/core/typed';
import * as GeoJSON from "geojson";

export interface LineStringMetaData {
  count: number;
  LocalIdentifier: string;
  sensorsUsed: string[];
  taxon: string[];
}

export interface PointProperties {
  date: Date;
  dateString: string;
}

// TODO: Consider if metadata can be added to the following types.
export type LineStringFeature<TProp> = GeoJSON.Feature<GeoJSON.LineString, TProp>;
export type PointFeature<TProp> = GeoJSON.Feature<GeoJSON.Point, TProp>;

export type LineStringFeatureCollection<TProp> = GeoJSON.FeatureCollection<GeoJSON.LineString, TProp>;
export type PointFeatureCollection<TProp> = GeoJSON.FeatureCollection<GeoJSON.Point, TProp>;

// TODO: V1 needs to be phased out.
export interface LineStringPropertiesV1 {
  from: Date;
  to: Date;
  color: Color;
  sourceColor: Color;
  targetColor: Color;
  content: string;
  distance: number;
  distanceTravelled: number;
}

export interface LineStringPropertiesV2 {
  sourceTimestamp: bigint;
  destinationTimestamp: bigint;
  content: string;
  distanceKm: number;
  distanceTravelledKm: number;
}

export type LineStringFeatures<TProp> = {
  features: LineStringFeature<TProp>[];
  individualLocalIdentifier: string;
  index: number;
  count: number;
}
