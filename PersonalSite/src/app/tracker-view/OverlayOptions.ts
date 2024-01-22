// NOTE: This object should one of three types
// from the following categories
import { EventMetaData } from "../events/EventsMetadata"
import { Color } from '@deck.gl/core/typed';

// Point Layers, Path layers, and aggregation layers
// NOTE: This type is used for arc, line and path layers.
export type OverylayPathOptions = {
  metadata: EventMetaData;
  currentIndividual: string;
  opacity: number;
  SourcePosition?: number;
  TargetPosition?: number;
  tilt?: number;
  getPosition: number;
  widthScale: number;
  widthUnits: 'pixel' | 'common' | 'meters';
  widthMinPixels: number;
  widthMaxPixels: number;
  focusOpacity: number; // This is a custom option meant to reduce the opacity of individual not selected.
  textEnabled: boolean;
}

// NOTE: Currently this only holds information for the scatterplot layer.
export type PointOverlayOptions = {
  metadata: EventMetaData;
  currentIndividual: string;
  opacity: number;
  getRadius: number;
  radiusScale: number;
  radiusUnits: 'pixel' | 'common' | 'meters';
  widthMinPixels: number;
  widthMaxPixels: number;
  getFillColor: Color;
  getLineColor: Color;
}

// TODO: Finish coming up with the options and controls tommorow.
export type AggregationLayer = {
  radius: number;
  coverage: number;
  elevationRange: Array<number>;
  elevationScale: number;
  upperPercentile: number;
  lowerPercentile: number;
  elevationLowerPercentile: number;
  elevationUpperPercentile: number;
  colorScaleType?: 'quantize' | 'quantile' | 'ordinal' // Scaling functions used to determine the color of the grid cell.
  material: boolean; // Unused.
  colorAggregation: 'SUM' | 'MEAN' | 'MAX' | "MIN"; // Options are SUM, MEAN, MIN, MAX
  elevationAggregation: 'SUM' | 'MEAN' | 'MAX' | "MIN"; // Options Are SUM, MEAN, MIN, MAX
  getColorWeight: number;
  // getColorValue: null, // If provided, will override the value of getColorWeight and colorAggregation.
  // getElevationValue: null, // Do not use for now.
  getElevationWeight: number;
  gpuAggregration: boolean; // This should always be true.
}
