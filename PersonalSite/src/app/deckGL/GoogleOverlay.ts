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
import { setData } from './deck-gl.worker';
// import { loadInBatches, JSONLoader, LoaderOptions } from '@loaders.gl/core';
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

// TODO: This interface will need an update once another map component is created.
export interface WorkerFetchRequest {
  readonly type: "FetchRequest";
  overlay: DeckOverlay;
  map: google.maps.Map;
  request: Request;
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

  webWorker?: Worker;

  // TODO: Refactor this to use a suitable data source that be updated without clearing all of the layers.
  // NOTE:  Switching to a new event source will require a complete reload of all entities but
  // fetching more data from a specific individual should not. (the data source can be updated with more entities to
  // avoid another api request and layer instantiation.)
  // It may be better to request an array of features from the backend and then create geojsonlayers from each individual array response.

  constructor(map: google.maps.Map) {
    this.map = map;
    if (typeof Worker !== 'undefined') {
      if (!this.webWorker) {
        this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));
      }
    } else {
      console.error("Web worker api not supported.");
    }
  }

  loadData(request: Request) {
    // NOTE: This function simply decides which thread the loader get run on.
    if (this.deckOverlay == undefined || this.map === undefined) {
      console.error("Overlay or map not set");
      return;
    }
    const workerRequest: WorkerFetchRequest = {
      type: "FetchRequest",
      overlay: this.deckOverlay,
      map: this.map,
      request: request,
    };
    if (this.webWorker !== undefined) {
      this.webWorker.postMessage({ data: workerRequest });
    } else {
      setData(workerRequest);
    }

  }

  // NOTE: This method will clear all of the lineString layers.
  // 1) After successfully loading the event content the event component should close
  // 2) and the map should pan to an arbitrary point along the path.
  // 3) Consider if the observable should be subscribed to in the maps component
  // in order to differentiate between forbiden and error responnses.
  setLineData(collections: LineStringFeatureCollection[] | null) {
    console.log("Adding layers to google maps.");
    this.arcLineLayers.clear();
    if (this.deckOverlay) {
      this.deckOverlay.finalize();
    }

    if (collections === null) {
      return;
    }

    // this.webWorker?.postMessage({ data: "deck.gl message" });

    // Consider moving this function to a web worker.
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

  handlePickEvent(object: LineFeature, layer: Layer<object>): TooltipContent | null {
    if (layer.id.startsWith("ArcLayer")) {
      return {
        html: object.properties.content,
      } as TooltipContent;
    }
    return null;
  }

// async addArcLayerUrl(request: Request) {
//   try {
//     // const url: string = 'https://localhost:40443/api/MoveBank/GetEventData?studyId=312057662&sensorType=GPS&individualLocalIdentifiers=02&individualLocalIdentifiers=11&individualLocalIdentifiers=20&individualLocalIdentifiers=23&individualLocalIdentifiers=27&individualLocalIdentifiers=41&individualLocalIdentifiers=48&individualLocalIdentifiers=Bat1_3D6001852B958&individualLocalIdentifiers=Bat2_3D6001852B95D&individualLocalIdentifiers=Bat3_3D6001852B978&individualLocalIdentifiers=Bat4_3D6001852B980&individualLocalIdentifiers=Bat5_3D6001852B98C&individualLocalIdentifiers=Bat6_3D6001852B98E&individualLocalIdentifiers=Bat7_3D6001852B9A3&individualLocalIdentifiers=Bat8_3D6001852B9A7&geoJsonFormat=linestring';
//     // TODO: Set the options for batch loading manually.
//     // Implement a custom filter if an element is selected.
//     console.log(request);
//     const loaderOptions: LoaderOptions = {
//       fetch: {
//         method: "POST",
//       }
//     };
//
//     console.log(loaderOptions);
//
//     const loader = JSONLoader;
//     loader.options = {
//       json: { jsonpaths: ['$.features']}
//     };
//
//     const batches = await loadInBatches(request.url, loader);
//
//     const layers = [] as Array<ArcLayer>;
//     console.log(batches);
//
//     for await (const batch of batches) {
//
//       console.log(batch);
//       let i = 0;
//
//       for (const featureCollection of batch.data) {
//         console.log(featureCollection);
//         const arcLayer = new ArcLayer({
//           data: featureCollection.features, // Missing parameters
//           id: `${i}`,
//           pickable: true,
//           getSourcePosition: feature => feature.geometry.coordinates[0],
//           getTargetPosition: feature => feature.geometry.coordinates[1],
//           getWidth: 5,
//           getSourceColor: feature => feature.properties.sourceColor,
//           getTargetColor: feature => feature.properties.targetColor,
//         });
//
//         i++;
//         layers.push(arcLayer);
//       }
//       console.log(layers);
//       this.deckOverlay = new DeckOverlay({
//         layers: layers,
//       });
//
//       this.deckOverlay.setMap(this.map);
//     }
//
//   } catch (error) {
//     console.error(error);
//   }
// }

// This method is fired when a pickable object is hovered over.

}
