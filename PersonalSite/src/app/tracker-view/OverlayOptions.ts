// NOTE: This object should one of three types

import { FormControl } from "@angular/forms";

// RGBA or RGB
type Color = [number, number, number, number] | [number, number, number];

// type Position = [number, number] | [number, number, number] // XYZ or XY
// type OverlayTypes = "pathOverlayOptions" | "pointOverlayOptions" | "AggregationOverlayOptions";
// type AggrgationTypes = "SUM" | "MEAN";
// type GridAggregationTypes = "SUM" | "MEAN" | "MIN" | "MAX";
// // NOTE: This type is used to select the type of coloring in aggragation layers.
// type ColorScalingTypes = "quantize" | "quantile" | "ordinal";

// NOTE:Look through deck.gl documentaion to
// see which options form a base
// for the arc and path layers.

// Derived class must override certain fields
// export class PathOverlayBaseClass<T> {
//   // NOTE: The options in the constructor
//   // has certain fields that are carried over on every chunk load.
//   // This would include:
//   constructor(
//     // This first value hold the initial type which in this case is path.
//     value: T | undefined,
//     type: OverlayTypes,
//     individual: string,
//     getPosition?: Position,
//     getColor?: Color,
//     getSourcePosition?: Position,
//     getTargetPosition?: Position,
//     // options:  { key, value: string[]},
//   ) {
//   }
//   // type: string;
//   // getWidth: number = 1;
//   autoHighlight: boolean = true;
//   widthUnits: 'pixels' | 'meters' | 'common' = 'pixels';
//   widthScale: number = 1;
//
//   widthMinPixels: number = 1;
//   widthMaxPixels: number = Number.MAX_SAFE_INTEGER;
//
//   opacity: number = 0.8;
// }

// export class PointOverlayOptionsBase<T> {
//   constructor(
//     // This first value hold the initial type which in this case is path.
//     value: T | undefined,
//     type: OverlayTypes,
//     individual: string,
//     getPosition?: Position,
//     getColor?: Color,
//     getSourcePosition?: Position,
//     getTargetPosition?: Position,
//   ){
//   }
// }

// Reconsider this type if it is necesssary for path and point types.
// export class AggregationOverlayOptionsBase<T>{
//   constructor(
//     // value: T | undefined,
//     type: OverlayTypes,
//     individual: string,
//     getPosition?: Position,
//     getColor?: Color,
//     getSourcePosition?: Position,
//     getTargetPosition?: Position,
//   ){
//   }
//   elevationRange: Range = [0, 1000];
//   elevationScale: number = 1;
//
//   elevationUpperPercentile: number = 100;
//   elevationLowerPercentile: number = 0;
//
//   upperPercentile: number = 100;
//   lowerPercentile: number = 0;
//
//   colorScaleType: ColorScalingTypes = "quantize";
//   colorAggregation: GridAggregationTypes = "SUM";
//   elevationAggregation: GridAggregationTypes = "SUM";
//
//   getColorWeight: number = 1;
//   getElevationWeight: number = 1;
// }
// TODO: Next step is to implement the derived classes
// and override the defaults fields as necessary.
// The specific type argument should be a
// string or a union of string literals.
// export class PathLayerMessage extends PathOverlayBaseClass<OverlayTypes>{
//   constructor(
//
//   ){
//     // super(
//     // );
//   }

// TODO:Consider a rename
export type PointForms = {
  // type: "pathForms";
  currentIndividual: FormControl<string>;
  getRadius: FormControl<number>;
  filled: FormControl<boolean>;

  autoHighlight: FormControl<boolean>;

  opacity: FormControl<number>;
  focusLevel: FormControl<number>;

  radiusMinPixels: FormControl<number>;
  radiusMaxPixels: FormControl<number>;

  getFillColor: FormControl<string>;
  // getFillColor: FormControl<Color>;
  // getLineColor: FormControl<Color>;
  getLineColor: FormControl<string>;
}
// TODO:
// 1) Provide some methods here to adjust the message
// 2) itself or put it in the base class.
// 3) Another approach is create a service to build up the form.
// 4) Consider if another forms is needed to control certain attributes all at once such as radius
export type PointOverlayOptions = {
  type: "pointOverlayOptions",

  currentIndividual: string;
  getRadius: number;
  filled: boolean;

  autoHighlight: boolean;

  opacity: number;
  focusLevel: number;

  radiusMinPixels: number;
  radiusMaxPixels: number;

  getFillColor: Color;
  getLineColor: Color;
}

// TODO: since that data gets sent in a different message.
// Certain inputs can be saved when the layers changes.
// Instead of switching them out entirely we can toggle their visibility.

export type PathForms = {
  currentIndividual: FormControl<string>;
  widthScale: FormControl<number>;

  opacity: FormControl<number>;

  widthMinPixels: FormControl<number>;
  widthMaxPixels: FormControl<number>;

  getSourceColor: FormControl<string>;
  getTargetColor: FormControl<string | null>; // this is an optional field

  focusLevel: FormControl<number>;
  autoHighlight: FormControl<boolean>;
}

// NOTE: This file contains type meant to sent as messages from the event
// component in order to change certain options in the overlay controls.
export type PathOverlayOptions = {
  type: "pathOverlayOptions",

  currentIndividual: string;
  widthScale: number; // Field in line layers

  opacity: number;

  widthMinPixels: number;
  widthMaxPixels: number;

  // This fields is used as the value for getColor in line layers instantiatation.
  getSourceColor: Color;
  getTargetColor?: Color;

  focusLevel: number;

  autoHighlight: boolean;
  textEnabled?: boolean;
}

export type AggregationForms = {
  currentIndividual: FormControl<string | null>;
  radius: FormControl<number>;

  elevationRange: FormControl<[number, number]>;
  elevationScale: FormControl<number>;

  upperPercentile: FormControl<number>;
  lowerPercentile: FormControl<number>;

  elevationLowerPercentile: FormControl<number>;
  elevationUpperPercentile: FormControl<number>;

  elevationAggregation: FormControl<'SUM' | 'MEAN' | 'MAX' | 'MIN'>;

  // nullable forms denote an optional field
  colorScaleType: FormControl<'quantize' | 'quantile' | 'ordinal' | null>;
  colorAggregation: FormControl<'SUM' | 'MEAN' | 'MAX' | 'MIN'>;

  getColorWeight: FormControl<number>;
  getElevationWeight: FormControl<number>;
}
// TODO: In the deckoverlay class where this message arrives in,
// make sure to differentiate between the three types of
// overlay controls messages.
export type AggregationOverlayOptions = {
  type: "aggregationOverlayOptions",

  currentIndividual: string;
  radius: number;
  // coverage: number;
  elevationRange: [number, number];
  elevationScale: number;
  upperPercentile: number;
  lowerPercentile: number;

  elevationLowerPercentile: number;
  elevationUpperPercentile: number;
  elevationAggregation: 'SUM' | 'MEAN' | 'MAX' | 'MIN';

  colorScaleType?: 'quantize' | 'quantile' | 'ordinal' // Scaling functions used to determine the color of the grid cell.
  colorAggregation: 'SUM' | 'MEAN' | 'MAX' | 'MIN';

  getColorWeight: number;
  getElevationWeight: number;
}
