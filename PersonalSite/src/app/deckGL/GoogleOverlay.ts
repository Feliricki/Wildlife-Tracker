import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { GeoJsonLayer } from '@deck.gl/layers/typed';
import { Color } from '@deck.gl/core/typed';
/// import { TripsLayer } from '@deck.gl/geo-layers/typed';
// import { ArcLayer } from '@deck.gl/layers/typed';
// import type * as LayerProps from '@deck.gl/core/typed';
import * as GeoJSON from "geojson";

// NOTE: These interfaces needs to be synchronized with the backend's version.
export interface LineStringMetaData {
  count: number;

  localIdentifier: string[];
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
  content: string;
  distance: number;
  distanceTravelled: number;
}

// TODO: Reevalutate what type to return from the backend for lineString geoJson Data.
// Observable is being sent to the googles maps component.
export type LineFeature = GeoJSON.Feature<GeoJSON.LineString, LineStringProperties>;
export type LineStringFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, LineStringProperties> & LineStringMetaData;

type PointFeature = GeoJSON.Feature<GeoJSON.Point, PointProperties>;
type PointFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PointProperties> & LineStringMetaData;

type LayerId = string;

export class GoogleMapOverlayController {
  map: google.maps.Map;
  deckOverlay?: DeckOverlay;

  // INFO: A layer is created for each individual.
  geoJsonLineLayers = new Map<LayerId, GeoJsonLayer<LineStringProperties>>;
  pointGeoJsonLayers = new Map<LayerId, GeoJsonLayer<PointProperties>>;

  visibleLayers = {
    geoJsonPath: false,
    scatterPlot: false,
  };

  // TODO: Refactor this to use a suitable data source that be updated without clearing all of the layers.
  // NOTE:  Switching to a new event source will require a complete reload of all entities but
  // fetching more data from a specific individual should not. (the data source can be updated with more entities to
  // avoid another api request and layer instantiation.)
  // It may be better to request an array of features from the backend and then create geojsonlayers from each individual array response.

  constructor(map: google.maps.Map) {
    this.map = map;
    this.deckOverlay = new DeckOverlay({});
    console.log("Initialized DeckOverlay.")
  }

  setLineData(...lineData: LineStringFeatureCollection[]) {
    // TODO: Consider using a WeakMap to clear this memory asap.
    this.geoJsonLineLayers.clear();
    if (this.deckOverlay) {
      this.deckOverlay.finalize();
    }

    const layers = [];
    for (const lineCollection of lineData){

      const layerId = `geojsonLineLayer-${lineCollection.localIdentifier}`;
      const geoJsonLayer = this.addGeoJsonLineLayer(lineCollection, layerId);

      layers.push(geoJsonLayer);
    }

    this.deckOverlay = new DeckOverlay({
      layers: layers
    });

    this.deckOverlay.setMap(this.map);
  }

  patchLineData(layerId: string, lineData: LineStringFeatureCollection) {
    const layer = this.geoJsonLineLayers.get(layerId);
    if (!layer){
      return;
    }
    layer.props.data = lineData;
  }

  // TODO: Ideally, we want clear the map when a new source is added and replace the source with the new information.
  // TODO: The backend should preprocess this data into the following format.
  // An implicit assumption is that the events are sorted by date (using their timestamp).
  // Better to use RBGA format to highlight a specific line or point (other point can have their opacity lowered)
  addGeoJsonLineLayer(lineStringCollection: LineStringFeatureCollection, layerId: string) {
    const lineLayer = new GeoJsonLayer({
      id: layerId,
      data: lineStringCollection,
      colorFormat: "RGBA",
      pickable: true,
      stroked: false,
      filled: true,
      extruded: true,
      pointType: "circle",
      lineWidthScale: 20,
      getFillColor: [160, 160, 180, 200],
      getLineColor: feature => feature.properties!["color"],
      getPointRadius: 100,
      getLineWidth: 1,
      getElevation: 30,
    });

    return lineLayer;
  }
}
