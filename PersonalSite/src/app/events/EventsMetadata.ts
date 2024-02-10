import { LayerTypes } from "../deckGL/GoogleOverlay"
// import { PathOverlayOptions, PointOverlayOptions, AggregationOverlayOptions } from "../tracker-view/OverlayOptions";

type RGBA = [number, number, number, number];
type Color = [number, number, number, number] | RGBA;

type Position = [number, number, number]

// NOTE:This metadata is created on each chunk load.
// The information sent using this type should contain
// data on the current state of the specified layer.
// Or should general information about all the layers be specified here.
export type EventMetaData = {
  layer: LayerTypes;
  // INFO: The layer information  should only contain the types specified by
  // the layer field.
  // layerInformation: Array<PathOverlayOptions | PointOverlayOptions | AggregationOverlayOptions>;
  numberOfEvents: number;
  numberOfIndividuals: number;
  currentIndividuals: Set<string>; // TODO: These options are subject to change.
  pathWidth: number;
  widthUnits: 'pixel' | 'meters' | 'common';

  // One of source+target / getColor field should be specified
  sourceColor?: Color;
  targetColor?: Color;
  getColor?: Color;

  sourcePosition?:Position;
  targetPosition?:Position;
  getPosition?:Position;

  textLayer: boolean;
}
