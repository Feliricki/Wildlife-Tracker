import { Color } from '@deck.gl/core/typed';
import * as GeoJSON from "geojson";


export type LineFeature = GeoJSON.Feature<GeoJSON.LineString, LineStringProperties>;
export type LineStringFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, LineStringProperties> & { metadata: LineStringMetaData };

export type PointFeature = GeoJSON.Feature<GeoJSON.Point, PointProperties>;
export type PointFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PointProperties> & LineStringMetaData;
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

export interface LineStringProperties {
  from: Date;
  to: Date;
  color: Color;
  sourceColor: Color;
  targetColor: Color;
  content: string;
  distance: number;
  distanceTravelled: number;
}
