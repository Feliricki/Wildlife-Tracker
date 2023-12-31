import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers/typed';
import { Color, Layer } from '@deck.gl/core/typed';
import { TooltipContent } from '@deck.gl/core/src/lib/tooltip'
import { PathLayer } from '@deck.gl/layers/typed';
// import { MapboxOverlay } from '@deck.gl/mapbox/typed';
/// import { TripsLayer } from '@deck.gl/geo-layers/typed';
import { ArcLayer } from '@deck.gl/layers/typed';
// import type * as LayerProps from '@deck.gl/core/typed';
import * as GeoJSON from "geojson";
import { loadInBatches, JSONLoader, LoaderOptions } from '@loaders.gl/core';
// import { JSONLoader } from '@loaders.gl/json'
// import { JSONLoader } from '@loaders.gl/core';
// import { Observable } from 'rxjs';

// TODO: This class eventually needs to be refactored and renamed to accept a mapbox overlay.
// NOTE: These interfaces needs to be synchronized with the backend's version.
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


// TODO: Reevalutate what type to return from the backend for lineString geoJson Data.
// Observable is being sent to the googles maps component.
export type LineFeature = GeoJSON.Feature<GeoJSON.LineString, LineStringProperties>;
export type LineStringFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, LineStringProperties> & { metadata: LineStringMetaData };

// type PointFeature = GeoJSON.Feature<GeoJSON.Point, PointProperties>;
// type PointFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PointProperties> & LineStringMetaData;

type LayerId = string;

export class GoogleMapOverlayController {
  map: google.maps.Map;
  deckOverlay?: DeckOverlay;

  // INFO: A layer is created for each individual.
  geoJsonLineLayers = new Map<LayerId, GeoJsonLayer<GeoJsonLayerProps>>;
  arcLineLayers = new Map<LayerId, ArcLayer<object>>;
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
    // this.deckOverlay = new DeckOverlay({});
    // this.deckOverlay.setMap(this.map);
  }

  // NOTE: This method will clear all of the lineString layers.
  // 1) After successfully loading the event content the event component should close
  // 2) and the map should pan to an arbitrary point along the path.
  // 3) Consider if the observable should be subscribed to in the maps component
  // in order to differentiate between forbiden and error responnses.
  setLineData(collections: LineStringFeatureCollection[] | null) {
    console.log("Adding layers to google maps.");
    // this.geoJsonLineLayers.clear();
    this.arcLineLayers.clear();
    if (this.deckOverlay) {
      this.deckOverlay.finalize();
    }

    if (collections === null) {
      return;
    }

    // Consider moving this function to a web worker.
    console.log(collections.at(0));
    const layers = [];
    for (const lineCollection of collections) {

      const layerId = `ArcLayer-${lineCollection.metadata.LocalIdentifier}`;
      const arcLayer = this.addArcLayer(lineCollection, layerId);

      layers.push(arcLayer);
    }

    console.log(`Adding ${layers.length} layers to Deckoverlay.`);
    this.deckOverlay = new DeckOverlay({
      layers: layers,
      _typedArrayManagerProps: {
        overAlloc: 1,
        poolSize: 0
      },
      getTooltip: ({ object, layer }) => object && layer && this.handlePickEvent(object, layer),
    });

    this.deckOverlay.setMap(this.map);
  }

  patchLineData(layerId: string, lineData: LineStringFeatureCollection) {
    if (!this.geoJsonLineLayers.has(layerId)) {
      return;
    }

    const layer = this.geoJsonLineLayers.get(layerId);
    if (!layer) {
      return;
    }
    layer.props.data = lineData;
  }



  addPathLayer(lineStringFeatureCollection: LineStringFeatureCollection, layerId: string) {
    const pathLayer = new PathLayer({
      id: layerId,
      data: lineStringFeatureCollection.features,
      pickable: true,
      widthScale: 20,
      widthMinPixels: 2,
      getPath: d => d.geometry.coordinates,
    });

    return pathLayer;
  }

  addArcLayer(lineStringFeatureCollection: LineStringFeatureCollection, layerId: string) {
    // const url = this.environment
    const arcLayer = new ArcLayer({
      id: layerId,
      data: lineStringFeatureCollection.features,
      pickable: true,
      getSourcePosition: feature => feature.geometry.coordinates[0],
      getTargetPosition: feature => feature.geometry.coordinates[1],
      getWidth: 5,
      getSourceColor: feature => feature.properties.sourceColor,
      getTargetColor: feature => feature.properties.targetColor,
    })
    return arcLayer;
  }

  async addArcLayerUrl(request: Request) {
    try {
      // const url: string = 'https://localhost:40443/api/MoveBank/GetEventData?studyId=312057662&sensorType=GPS&individualLocalIdentifiers=02&individualLocalIdentifiers=11&individualLocalIdentifiers=20&individualLocalIdentifiers=23&individualLocalIdentifiers=27&individualLocalIdentifiers=41&individualLocalIdentifiers=48&individualLocalIdentifiers=Bat1_3D6001852B958&individualLocalIdentifiers=Bat2_3D6001852B95D&individualLocalIdentifiers=Bat3_3D6001852B978&individualLocalIdentifiers=Bat4_3D6001852B980&individualLocalIdentifiers=Bat5_3D6001852B98C&individualLocalIdentifiers=Bat6_3D6001852B98E&individualLocalIdentifiers=Bat7_3D6001852B9A3&individualLocalIdentifiers=Bat8_3D6001852B9A7&geoJsonFormat=linestring';
      // TODO: Set the options for batch loading manually.
      // Implement a custom filter if an element is selected.
      console.log(request);
      const loaderOptions: LoaderOptions = {
        fetch: {
          method: "POST",
        }
      };

      const loader = JSONLoader;
      loader.options = {
        json: { jsonpaths: ['$.features']}
      };

      const batches = await loadInBatches(request.url, loader);

      const layers = [] as Array<ArcLayer>;
      console.log(batches);

      for await (const batch of batches) {

        console.log(batch);
        let i = 0;

        for (const featureCollection of batch.data) {
          console.log(featureCollection);
          const arcLayer = new ArcLayer({
            data: featureCollection.features, // Missing parameters
            id: `${i}`,
            pickable: true,
            getSourcePosition: feature => feature.geometry.coordinates[0],
            getTargetPosition: feature => feature.geometry.coordinates[1],
            getWidth: 5,
            getSourceColor: feature => feature.properties.sourceColor,
            getTargetColor: feature => feature.properties.targetColor,
          });

          i++;
          layers.push(arcLayer);
        }
        console.log(layers);
        this.deckOverlay = new DeckOverlay({
          layers: layers,
        });

        this.deckOverlay.setMap(this.map);
      }

    } catch (error) {
      console.error(error);
    }
  }

  // This method is fired when a pickable object is hovered over.
  handlePickEvent(object: LineFeature, layer: Layer<object>): TooltipContent | null {

    if (layer.id.startsWith("ArcLayer")) {
      return {
        html: object.properties.content,
      } as TooltipContent;
    }
    return null;
  }

// TODO: Ideally, we want clear the map when a new source is added and replace the source with the new information.
// TODO: The backend should preprocess this data into the following format.
// An implicit assumption is that the events are sorted by date (using their timestamp).
// Better to use RBGA format to highlight a specific line or point (other point can have their opacity lowered)
// addGeoJsonLineLayer(lineStringCollection: LineStringFeatureCollection, layerId: string): GeoJsonLayer<GeoJsonLayerProps> {
//
//   // console.log(JSON.stringify(lineStringCollection));
//   const lineLayer = new GeoJsonLayer({
//     id: layerId,
//     data: lineStringCollection,
//     colorFormat: "RGB",
//     pickable: true,
//     stroked: false,
//     filled: true,
//     extruded: true,
//     pointType: "circle",
//     lineWidthScale: 20,
//     lineWidthMinPixels: 2,
//     getFillColor: [160, 160, 180, 200],
//     // getLineColor: [0, 255, 0, 1],
//     // getLineColor: feature => feature.properties.color,
//     // getLineColor: [120, 120, 120, 1],
//     getPointRadius: 100,
//     getLineWidth: 1,
//     getElevation: 30,
//     onError: error => {
//       console.error(error);
//       return true;
//     },
//   });
//
//   return lineLayer;
// }
}
