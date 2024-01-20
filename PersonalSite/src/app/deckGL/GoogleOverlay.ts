import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
// import { TripsLayer } from '@deck.gl/geo-layers/typed';
// import type * as LayerProps from '@deck.gl/core/typed';
import { ArcLayer, LineLayer, ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers/typed';
import { PickingInfo, Layer, Color } from '@deck.gl/core/typed';
import { randomColor } from './deck-gl.worker';
import { LineStringPropertiesV2 } from "./GeoJsonTypes";
import { BinaryLineStringResponse, NumericPropsResponse, OptionalAttributes, WorkerFetchRequest } from "./MessageTypes";
import { EventRequest } from "../studies/EventRequest";
import { BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures, BinaryAttribute } from '@loaders.gl/schema';
import { Signal, WritableSignal, signal } from '@angular/core';
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers/typed';

type BinaryFeatureWithAttributes = {
  points?: BinaryPointFeatures;
  lines: BinaryLineFeatures & OptionalAttributes;
  polygons?: BinaryPolygonFeatures;
};

// TODO: Layers to implement
// arclayer, linelayer, heatmaplayer, hexagonlayer, scatterplotLayer and the trips layers.
// Work out a user interface for showing layers within a certain timeframe.
export enum LayerTypes {
  ArcLayer,
  ContourLayer,
  GeoJsonLayer,
  HeatmapLayer,
  HexagonLayer,
  IconLayer,
  LineLayer,
  PointCloudLayer,
  PathLayer,
  ScatterplotLayer,
  ScenegraphLayer,
  ScreenGridLayer,
  TerrainLayer,
  TextLayer,
  TileLayer,
  Tile3DLayer,
  TripsLayer,
  WMSLayer,
}

export type StreamStatus = "standby" | "streaming" | "error";

export class GoogleMapOverlayController {
  map: google.maps.Map;
  deckOverlay?: DeckOverlay | MapboxOverlay;

  // INFO: A layer is created for each individual.
  // geoJsonLineLayers = new Map<LayerId, GeoJsonLayer<GeoJsonLayerProps>>;
  // arcLineLayers = new Map<LayerId, ArcLayer<object>>;
  // pointGeoJsonLayers = new Map<LayerId, GeoJsonLayer<PointProperties>>;

  webWorker?: Worker;

  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  contentArray: ArrayBufferLike[][] = [];

  textDecoder = new TextDecoder();
  textEncoder = new TextEncoder();

  streamStatus: WritableSignal<StreamStatus> = signal("standby");
  currentAnimals = new Map<string, [Color, Color]>();

  //TODO: Decide on a default layer.
  currentLayer: LayerTypes = LayerTypes.ArcLayer;
  currentData: Array<BinaryLineFeatures & OptionalAttributes> = [];

  constructor(map: google.maps.Map, layer: LayerTypes) {
    this.map = map;
    this.currentLayer = layer;
    console.log("About to start connection to signalr hub");

    if (typeof Worker !== 'undefined') {
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));
      console.log(this.webWorker);
      this.webWorker.onmessage = (message) => {
        switch (message.data.type) {

          case "BinaryLineString":
            this.handleBinaryResponse(message.data as BinaryLineStringResponse<LineStringPropertiesV2>);
            break;

          case "StreamEnded":
            this.streamStatus.set("standby");
            break;

          case "StreamError":
            this.streamStatus.set("error");
            break;

          default:
            return;
        }
      }
    } else {
      // TODO: Handle the work on the main thread by calling the function from mainthread with the right flag.
      console.error("Web worker api not supported.");
    }
  }

  get StreamStatus(): Signal<StreamStatus> {
    return this.streamStatus.asReadonly();
  }

  loadData(request: EventRequest) {
    console.log("Begun loading event data.");

    this.dataChunks = [];
    this.contentArray = [];
    this.currentAnimals.clear();
    this.deckOverlay?.finalize();
    this.streamStatus.set("streaming");

    this.deckOverlay = new DeckOverlay({
      getTooltip: (data) => data.layer && this.renderBinaryTooltip(data),
      _typedArrayManagerProps: {
        overAlloc: 1,
        poolSize: 0,
      }
    });
    this.deckOverlay.setMap(this.map);

    const workerRequest: WorkerFetchRequest = {
      type: "FetchRequest",
      request: request,
    };

    if (this.webWorker !== undefined) {
      this.webWorker.postMessage({ data: workerRequest, type: "FetchRequest" as const });
    }
    else {
      // TODO:There need to be a fallback mechanism if webworker are not supported.
      // setData(workerRequest, true);
    }
  }

  renderBinaryTooltip(info: PickingInfo) {
    const index = info.index;
    if (index === -1) {
      return null;
    }
    const text = this.getContentHelper(index, info);
    return text === undefined ? null : { html: text };
  }

  // TODO:This needs to be refactored to show different content depending on the current layer.
  getContentHelper(index: number, info: PickingInfo): string | undefined {
    const layerIndex = Number(info.layer?.id.split('-').at(1));
    if (layerIndex === undefined) {
      return;
    }
    const content = this.contentArray.at(layerIndex)?.at(index);

    if (content === undefined) {
      return;
    }

    const text = this.textDecoder.decode(new Uint8Array(content));
    return text;
  }

  // TODO: This method is untested.
  // This render the latest options selected by the users.
  // Test if the updateTrigger attribute is actually doing something.
  changeActiveLayer(layer: LayerTypes): void {
    if (this.currentLayer === layer || this.dataChunks.length === 0) return;
    this.currentLayer = layer;

    console.log(`Active layer is ${layer} in GoogleOverlay.`);

    const layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(layer, chunk.lines, index));
    this.deckOverlay?.setProps({ layers: layers });
  }

  // NOTE:This method create a layer for a single chunk of data.
  createActiveLayer(layer: LayerTypes, data: BinaryLineFeatures & OptionalAttributes, layerId: number): Layer | null {
    this.currentLayer = layer;
    switch (layer) {
      case LayerTypes.ArcLayer:
        return this.createArcLayer(data, layerId);
      case LayerTypes.LineLayer:
        return this.createLineLayer(data, layerId);
      case LayerTypes.ScatterplotLayer:
        return this.createScatterplotLayer(data, layerId);
      case LayerTypes.HexagonLayer:
        return this.createHexagonLayer(data, layerId);
      case LayerTypes.PathLayer:
        return this.createPathLayer(data, layerId);
      // case LayerTypes.HeatmapLayer:
      //   return this.createHeatmapLayer(data, layerId);
      default:
        return null;
    }
  }

  getCoordinateHelper(info: PickingInfo) {
    return `position: ${info.coordinate}`;
  }

  // NOTE: This method is called when the web worker finishes processing the requested event data.
  handleBinaryResponse(BinaryData: BinaryLineStringResponse<LineStringPropertiesV2>): void {
    const binaryLineFeatures: BinaryLineFeatures & OptionalAttributes = {
      featureIds: { size: BinaryData.featureId.size, value: new Uint16Array(BinaryData.featureId.value) },
      globalFeatureIds: { size: BinaryData.globalFeatureIds.size, value: new Uint16Array(BinaryData.globalFeatureIds.value) },
      positions: { size: BinaryData.position.size, value: new Float32Array(BinaryData.position.value) },
      pathIndices: { size: BinaryData.pathIndices.size, value: new Uint16Array(BinaryData.pathIndices.value) },
      length: BinaryData.length,
      content: BinaryData.content,
      colors: { size: BinaryData.colors.size, value: new Uint8Array(BinaryData.colors.value) },
      individualLocalIdentifier: BinaryData.individualLocalIdentifier,
      numericProps: this.numericPropsHelper(BinaryData.numericProps),
      properties: [],
      type: "LineString"
    };
    const [pointsFeatures, polygonFeatures] = this.BinaryFeaturesPlaceholder();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    this.contentArray.push(binaryLineFeatures.content.contentArray);

    const layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(this.currentLayer, chunk.lines, index));

    console.log(`Overlay has ${this.dataChunks.length} layers with ${this.contentArray.reduce((acc, arr) => acc + arr.length, 0)} total elements.`);
    this.deckOverlay?.setProps({
      layers: layers
    });
  }

  numericPropsHelper(props: NumericPropsResponse<LineStringPropertiesV2>) {
    return {
      sourceTimestamp: {
        size: props.sourceTimestamp.size,
        value: new Float64Array(props.sourceTimestamp.value)
      },
      destinationTimestamp: {
        size: props.destinationTimestamp.size,
        value: new Float64Array(props.destinationTimestamp.value)
      },
      distanceKm: {
        size: props.distanceKm.size,
        value: new Float64Array(props.distanceKm.value)
      },
      distanceTravelledKm: {
        size: props.distanceTravelledKm.size,
        value: new Float64Array(props.distanceTravelledKm.value)
      }
    } as { [key: string]: BinaryAttribute };
  }

  // NOTE: This helper method builds an empty points and line binaryFeaturesObjects.
  BinaryFeaturesPlaceholder(): [BinaryPointFeatures, BinaryPolygonFeatures] {
    return [
      {
        type: "Point",
        featureIds: { size: 1, value: new Uint16Array() },
        globalFeatureIds: { size: 1, value: new Uint16Array() },
        positions: { size: 2, value: new Float32Array() },
        numericProps: {},
        properties: []
      }, {
        type: "Polygon",
        featureIds: { size: 1, value: new Uint16Array() },
        globalFeatureIds: { size: 1, value: new Uint16Array() },
        positions: { size: 2, value: new Float32Array() },
        polygonIndices: { size: 1, value: new Uint16Array() },
        primitivePolygonIndices: { size: 1, value: new Uint16Array() },
        numericProps: {},
        properties: []
      }];
  }

  createAllLayers(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    return [
      this.createArcLayer(binaryFeatures, layerId),
      this.createLineLayer(binaryFeatures, layerId),
      this.createScatterplotLayer(binaryFeatures, layerId)
    ];
  }

  createArcLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);
    return new ArcLayer({
      id: `${LayerTypes.ArcLayer}-${layerId}`, // `{LayerType}-{chunkId}`
      data: {
        length: binaryFeatures.length,
        attributes: {
          getSourcePosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0,
          },
          getTargetPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: entrySize / 2,
          },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier)
        }
      },
      getSourceColor: colors[0],
      getTargetColor: colors[1],
      colorFormat: "RGBA",
      pickable: this.currentLayer === LayerTypes.ArcLayer,
      visible: this.currentLayer === LayerTypes.ArcLayer,
      getWidth: 5,
      widthMinPixels: 5,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    });
  }

  // TODO:Include an update trigger for pickable status and other options if applicable.
  // Include an option for changing the width and colors.
  // The same colors needs to be reused across layers.
  createLineLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE; // 2 positions *  2 coordinates * number of bytes.
    const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

    return new LineLayer({
      id: `${LayerTypes.LineLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getSourcePosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0
          },
          getTargetPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: entrySize / 2
          },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
        },
      },
      colorFormat: "RGBA",
      pickable: this.currentLayer === LayerTypes.LineLayer,
      visible: this.currentLayer === LayerTypes.LineLayer,
      getColor: colors[0],
      getWidth: 10,
      widthMinPixels: 5,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    });
  }

  createScatterplotLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    return new ScatterplotLayer({
      id: `${LayerTypes.ScatterplotLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0,
          },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
        },
      },
      pickable: this.currentLayer === LayerTypes.ScatterplotLayer,
      visible: this.currentLayer === LayerTypes.ScatterplotLayer,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  createHeatmapLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    return new HeatmapLayer({
      id: `${LayerTypes.HeatmapLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getPosition: {
            value: new Float32Array(positions.value),
            size: positionSize, // = 2
            stride: entrySize,
            offset: 0,
          },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
        },
      },
      // pickable: this.currentLayer === LayerTypes.HeatmapLayer,
      pickable: false,
      aggregation: "SUM",
      radiusPixels: 15,
      intensity: 1,
      threshold: 0.5,
      // weightsTextureSize: 512,
      // getPosition: features => features.value, // Implictly an any type.
      visible: this.currentLayer === LayerTypes.HeatmapLayer,
      // positionFormat: "XY", // TODO:Untested
      getWeight: 1,
      debounceTimeout: 1000 * 1, // TODO: This needs to adjusted.
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  createHexagonLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    return new HexagonLayer({
      id: `${LayerTypes.HexagonLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0,
          },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
        },
      },
      // pickable: this.currentLayer === LayerTypes.HexagonLayer,
      pickable: false,
      visible: this.currentLayer === LayerTypes.HexagonLayer,
      extruded: true,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  // TODO: Implement this layer as a the path layer in the tracker view component.
  // This should default to a path layer.
  createGeoJsonLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number){
    return new GeoJsonLayer({
      id: `${LayerTypes.GeoJsonLayer}-${layerId}`,
      data: binaryFeatures,
      pickable: this.currentLayer === LayerTypes.GeoJsonLayer,
      stroked: true,
      filled: true,
      colorFormat: "RGBA",
      getFillColor: [255, 0, 0, 255],
      getLineColor: this.getColorHelper(binaryFeatures.individualLocalIdentifier)[0],
      lineWidthMinPixels: 5,
    })
  }

  getColorHelper(animal: string): [Color, Color] {
    const color = this.currentAnimals.get(animal);
    if (color !== undefined) {
      return color;
    }
    const newColor = [randomColor(), randomColor()] as [Color, Color];
    this.currentAnimals.set(animal, newColor);
    return newColor;
  }

// renderTooltip(info: PickingInfo) {
//   console.log("picking info for geojson hover event.");
//   console.log(info);
//   console.log(info.index);
//   const el = document.getElementById("tooltip")!;
//   el.innerText = `tooltip for ${info.index} with id = ${info.layer?.id}`;
//   el.innerHTML = `<p>Some text</p>`;
//   el.style.display = 'block';
//   el.style.left = `${info.x} px`;
//   el.style.top = `${info.y} px`;
// }
}
