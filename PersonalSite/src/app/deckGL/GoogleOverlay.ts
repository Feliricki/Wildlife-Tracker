import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { GeoJsonLayer } from '@deck.gl/layers/typed';
import type * as GeoJSON from "geojson";

// This is extra data used for a FeatureCollection.
// TODO: This is probably in need of a rename here and in the backend,
// TODO: Use the name "CollectionProperties" and the other fields name "MetaData".
interface MetaData {
  count: number;
  pairs?: number;
  sensorsUsed?: string;
  localIdentifier: string;
  Taxa: string;
}
interface PointProperties {
  date: Date;
  dataString: string;
}
interface LineStringProperties {
  from: Date;
  to: Date;
  Content: string;
  Distance: number;
}

export class GoogleMapOverlay {
  map: google.maps.Map;
  deckOverlay: DeckOverlay;
  constructor(map: google.maps.Map, deckOverlay: DeckOverlay){
    this.map = map;
    this.deckOverlay = deckOverlay;
  }

  // TODO: Ideally, we want clear the map when a new source is added and replace the source with the new information.
  // TODO: The backend should preprocess this data into the following format.
  // An implicit assumption is that the events are sorted by date (using their timestamp).
  addLineLayer(lineStrings: GeoJSON.FeatureCollection<GeoJSON.LineString, LineStringProperties>) {
    const lineLayer  = new GeoJsonLayer({
      id: 'event-path',
      data: lineStrings,
      pickable: true,
      getWidth: 30,
    });

    return lineLayer;
  }
}
