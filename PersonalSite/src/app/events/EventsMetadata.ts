import { LayerTypes } from "../deckGL/GoogleOverlay"

// These metadata should be continously updated as new chunks arrive.
export type EventMetaData = {
  layer: LayerTypes;
  numberOfEvents: number;
  numberOfIndividuals: number;
  currentIndividuals: Set<string>; // TODO: These options are subject to change.
  pathWidth: number;
  widthUnits: 'pixel' | 'meters' | 'common';
  textLayer: boolean;
}
