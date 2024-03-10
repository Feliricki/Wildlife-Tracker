import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
// import { TripsLayer } from '@deck.gl/geo-layers/typed';
import { ArcLayer, LineLayer, ScatterplotLayer, PathLayer, ArcLayerProps, PathLayerProps, LineLayerProps, ScatterplotLayerProps } from '@deck.gl/layers/typed';
import { PickingInfo, Layer, Color, LayerProps } from '@deck.gl/core/typed';
import { randomColor } from './deck-gl.worker';
import { LineStringPropertiesV2 } from "./GeoJsonTypes";
import { BinaryLineStringResponse, NumericPropsResponse, OptionalAttributes, WorkerFetchRequest } from "./MessageTypes";
import { EventRequest } from "../studies/EventRequest";
import { BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures, BinaryAttribute } from '@loaders.gl/schema';
import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { HeatmapLayer, HeatmapLayerProps, HexagonLayer, HexagonLayerProps, ScreenGridLayer, ScreenGridLayerProps, GridLayer, GridLayerProps } from '@deck.gl/aggregation-layers/typed';
import { EventMetaData } from '../events/EventsMetadata';

// This is the type returned by the geoJsonToBinary function.
type BinaryFeatureWithAttributes = {
  points?: BinaryPointFeatures;
  lines: BinaryLineFeatures & OptionalAttributes;
  polygons?: BinaryPolygonFeatures;
};

// TODO:Agggregation layers are implemented incorrectly. Everything needs to be in a single layer.
// Work out a user interface for showing layers within a certain timeframe.

// NOTE:This files needs to be renamed when mapbox is used as a basemap.
export enum LayerTypes {
  ArcLayer,
  ContourLayer,
  GeoJsonLayer,
  GPUGridLayer,
  GridLayer, // TODO: try this out first then fallback to GPUGrid layer if it doesn't work.
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

// TODO:Write down the default options for each layer type.
export type OverlayPathOptions = {
  getWidth: number;
  widthUnit: 'pixel' | 'meters' | 'common';
  widthScale: number;
  widthMinPixels: number;
  widthMaxPixels: number;

  opacity: number; // number from 0 <= num <= 1
  getSourceColor: number;
  getTargetColor: number;
  getColor: number; // Specific to the path layer.
  autoHighlight: boolean;
}

export type OverlayPointOptions = {
  stroked: boolean;
  filled: boolean;

  radiusScale: number;
  lineWidthUnits: 'pixel' | 'meters' | 'common';
  getRadius: number;
  radiusMinPixels: number;
  radiusMaxPixels: number;

  getFillColor: Color; // Default format is RGBA
  getLineColor: Color;
  opacity: number;
}

// TODO: These options need to be compared to the other aggregation layers.
export type OverlayAggregationOptions = {
  getPosition: number;
  getWidth: number;
  radiusPixels: number;
  intensity: number; // 0 <= I < Inf
  threshold: number; // 0 < T < 1 - Basically the ratio of fading pixels to the max rate.
  aggregation: 'SUM' | 'MEAN';
  // colorRange: Array<Color>; NOTE:Not needed for now.
  // weightTextureSize: number;
}

export type StreamStatus = "standby" | "streaming" | "error";

export class GoogleMapOverlayController {
  map: google.maps.Map;
  deckOverlay?: DeckOverlay | MapboxOverlay;
  // NOTE: Not supported on older browsers.
  webWorker?: Worker;

  // INFO: The following are used to check for the category of some layer.
  readonly pathLayers = new Set<LayerTypes>([
    LayerTypes.ArcLayer,
    LayerTypes.PathLayer,
    LayerTypes.LineLayer,
    LayerTypes.GeoJsonLayer,
    LayerTypes.TripsLayer]);

  readonly pointLayers = new Set<LayerTypes>([
    LayerTypes.ScatterplotLayer
  ]);

  readonly aggregationLayers = new Set<LayerTypes>([
    LayerTypes.HeatmapLayer, LayerTypes.HexagonLayer, LayerTypes.ScreenGridLayer,
  ]);

  textDecoder = new TextDecoder();
  textEncoder = new TextEncoder();

  // TODO:Consider if recieved chunks can appended to their corresponding layer going by individual.
  // If it's posibble to pull this off then I should consider making a layer for each individual
  // and one large layer containing all the individual's event data.
  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  contentArray: ArrayBufferLike[][] = [];

  streamStatus: WritableSignal<StreamStatus> = signal("standby");
  individualColors = new Map<string, [Color, Color]>();
  currentIndividuals: WritableSignal<Set<string>> = signal(new Set());

  currentLayer: LayerTypes = LayerTypes.ArcLayer;
  currentData: Array<BinaryLineFeatures & OptionalAttributes> = [];

  // TODO:Test how these default settings function for the current layers.
  defaultBaseLayerOptions: Partial<LayerProps> = {
    autoHighlight: false,
    transitions: {} // Consider using this down the line.
  }


  defaultPointOptions: Partial<ScatterplotLayerProps> = {
    radiusUnits: 'meters',
    radiusScale: 1,
    lineWidthUnits: 'meters',
    lineWidthScale: 30,
    stroked: false,
    filled: true,
    autoHighlight: true,
    radiusMinPixels: 1.0,
    radiusMaxPixels: Number.MAX_SAFE_INTEGER,
    billboard: false,
    antialiasing: false,
    getRadius: 1,
    opacity: 0.8,
    getColor: undefined,
    getFillColor: undefined,
    getLineColor: undefined,
    getLineWidth: 1,
  }

  // TODO:Add the trips layer.
  defaultPathOptions: Partial<ArcLayerProps & LineLayerProps & PathLayerProps> = {
    // NOTE: Arc Layer Specific Options
    numSegments: 50,
    greatCircle: false,
    getHeight: 1,

    getSourceColor: undefined,
    getTargetColor: undefined,

    getSourcePosition: undefined,
    getTargetPosition: undefined,

    getTilt: 0, // -90 to 90

    // NOTE:Path Layer Specific Options
    getPath: undefined,
    getColor: undefined,
    capRounded: false,
    billboard: false, // if true, the path always faces the screen.
    miterLimit: 4, // Only applicable if roundedJoint = false.
    _pathType: "open", // If loop or open then the overlay will skip normalization.

    // NOTE:General Path Options
    autoHighlight: true,
    widthUnits: "pixels",
    widthScale: 1,
    getWidth: 3, // default = 1
    widthMinPixels: 1, // default = 0
    opacity: 0.8, // default = 1
  }

  defaultAggregationOptions: Partial<HeatmapLayerProps & HexagonLayerProps & ScreenGridLayerProps & GridLayerProps> = {
    // INFO:Hexagon specific options
    radius: 1000,
    coverage: 1, // Hexagon radius multipier

    // INFO:Hexagon and Grid Layer Options
    elevationRange: [0, 1000],
    elevationScale: 1, // Hexagon elevation multiplier
    upperPercentile: 100, // Hexagons range with a higher value than the upper percentile will be filtered.
    lowerPercentile: 0, // Same as upperPercentile but the opposite.
    elevationUpperPercentile: 100,
    elevationLowerPercentile: 0,
    colorScaleType: 'quantize', // Scaling functions used to determine the color of the grid cell.
    material: true, // Unused.
    colorAggregation: 'SUM', // Options are SUM, MEAN, MIN, MAX
    elevationAggregation: 'SUM', // Options Are SUM, MEAN, MIN, MAX
    getElevationValue: null, // Overrides value of getElevationWeight and ElevationAggregation
    getColorWeight: 1,
    getColorValue: null, // If provided, will override the value of getColorWeight and colorAggregation.
    getElevationWeight: 1,

    // INFO: Grid Specific Options
    gpuAggregation: true, // TODO:This needs to be to true in actual layers.

    // NOTE: The following will go unused for now.
    // hexagonAggregator: d3-hexbin,
    // colorDomain: null, (default = [min(ColorWeight), max(ColorWeight)](hexagon layer), )
    // colorRange: (default = colorbrewer - 6-class YlOrRd)
  }

  readonly MetadataDefaultOptions: EventMetaData = {
    layer: this.currentLayer,
    numberOfEvents: 0,
    numberOfIndividuals: 0,
    currentIndividuals: new Set(),
    pathWidth: 3,
    widthUnits: 'pixel',
    textLayer: false,
  };

  currentMetaData: WritableSignal<EventMetaData> = signal(
    {
      layer: this.currentLayer,
      numberOfEvents: 0,
      numberOfIndividuals: 0,
      currentIndividuals: new Set(),
      pathWidth: 3,
      widthUnits: 'pixel',
      textLayer: false,
    }
  );


  constructor(map: google.maps.Map, layer: LayerTypes) {
    this.map = map;
    this.currentLayer = layer;
    console.log("About to start connection to signalr hub");

    if (typeof Worker !== 'undefined') {
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));
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

  get NumberofIndividuals(): Signal<number> {
    return computed(() => this.currentIndividuals().size);
  }

  // INFO: This needs to be updated first.
  get CurrentIndividuals(): Signal<Set<string>> {
    return this.currentIndividuals.asReadonly();
  }

  // TODO: Finish this method. Create another enum type to hold all of the possible options.

  // NOTE: The purpose of this method is to accept custom controls from the
  // events component in order to change how events are displayed,filtered, transformed and so on.
  // If a command/option is invalid for the current layer type then it should simply be
  // ignored or disabled on the events component itself.
  // setNewOptions(option: string) {
  //   if (!this.deckOverlay) return;
  //   if (this.pathLayers.has(this.currentLayer)) {
  //     return;
  //   }
  //   else if (this.pointLayers.has(this.currentLayer)) {
  //     return;
  //   }
  //   else if (this.aggregationLayers.has(this.currentLayer)) {
  //     return;
  //   }
  //   return;
  // }

  loadData(request: EventRequest) {
    console.log("Begun loading event data.");
    // TODO: This needs to be refactored.
    this.dataChunks = [];
    this.contentArray = [];
    this.individualColors.clear();
    this.currentMetaData.set(structuredClone(this.MetadataDefaultOptions));
    this.currentIndividuals.set(new Set());
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

  // TODO: This method needs to be refactored to display different information depending the currently active layer.
  renderBinaryTooltip(info: PickingInfo) {
    const index = info.index;
    console.log(info);
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
    // if (this.currentLayer === layer || this.dataChunks.length === 0) return;
    if (this.currentLayer === layer) return;
    this.currentLayer = layer;
    console.log(`Active layer is ${layer} in GoogleOverlay.`);
    if (this.dataChunks.length === 0) return;

    const layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(layer, chunk.lines, index));
    this.deckOverlay?.setProps({ layers: layers });
  }

  isPointLayer(layer: LayerTypes): boolean {
    return this.pointLayers.has(layer);
  }

  isPathLayer(layer: LayerTypes): boolean {
    return this.pathLayers.has(layer);
  }

  isAggregationLayer(layer: LayerTypes): boolean {
    return this.aggregationLayers.has(layer);
  }

  // NOTE:This method create a layer for a single chunk of data.
  createActiveLayer(layer: LayerTypes, data: BinaryLineFeatures & OptionalAttributes, layerId: number): Layer | null {
    this.currentLayer = layer;

    switch (layer) {

      case LayerTypes.ArcLayer:
        return this.createArcLayer(data, layerId);

      case LayerTypes.ScatterplotLayer:
        return this.createScatterplotLayer(data, layerId);

      case LayerTypes.HexagonLayer:
        return this.createHexagonLayer(data, layerId);

      case LayerTypes.LineLayer:
        return this.createLineLayer(data, layerId);

      case LayerTypes.ScreenGridLayer:
        return this.createScreenGridLayer(data, layerId);

      case LayerTypes.GridLayer:
        return this.createGridLayer(data, layerId);

      // BUG: This layer is currently not working properly. The attributes are incorrectly formatted.
      // Fix at another time.
      // case LayerTypes.PathLayer:
      //   return this.createPathLayer(data, layerId);

      // NOTE: Heatmap layer is temporarily removed until it stops falling back to CPU aggregation.
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
      type: "LineString",
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
    };
    const [pointsFeatures, polygonFeatures] = this.BinaryFeaturesPlaceholder();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    // this.currentData.push(); // NOTE:This variable is being used to store all of the positions
    this.contentArray.push(binaryLineFeatures.content.contentArray);

    this.currentIndividuals.update(prev => {
      prev.add(binaryLineFeatures.individualLocalIdentifier);
      return prev;
    });

    // NOTE: This needs to be updated last.
    this.currentMetaData.update(prev => {
      return {
        numberOfEvents: prev.numberOfEvents + binaryLineFeatures.length,
        numberOfIndividuals: this.currentIndividuals().size,
        currentIndividuals: this.currentIndividuals(),
        layer: this.currentLayer,
        pathWidth: prev.pathWidth,
        widthUnits: prev.widthUnits,
        textLayer: prev.textLayer,
      } as EventMetaData;
    });

    // BUG:Aggregation layers needs to be all on the same layer to work properly.
    // This might be fine if individual can be toggled or shown one at time.
    // If this implementation is used, then all individuals should start out at the 'toggled on' state
    // If all user are toggled on then all individuals should belong to the same layer.
    // This will incur a signficant performance penalty on the main thread. This computation should be done on the webworker.
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
      id: `${LayerTypes.ArcLayer}-${layerId}`,
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
        },
      },
      getSourceColor: colors[0],
      getTargetColor: colors[1],
      autoHighlight: true,
      colorFormat: "RGBA",
      pickable: this.currentLayer === LayerTypes.ArcLayer,
      visible: this.currentLayer === LayerTypes.ArcLayer,
      getWidth: 3,
      widthMinPixels: 1,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    });
  }
  // TODO: This layer needs to have the start vertices specified.
  createPathLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    console.debug("Creating the path layer with layerId = " + layerId.toString());
    const startIndices: number[] = [0];
    for (let i = 0; i < binaryFeatures.length - 1; i++) {
      const lastIndex = startIndices[startIndices.length + 1] + binaryFeatures.positions.size;
      startIndices.push(lastIndex);
    }

    return new PathLayer({
      id: `${LayerTypes.PathLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getPath: {
            value: new Float32Array(binaryFeatures.positions.value),
            size: binaryFeatures.positions.size,
            stride: entrySize,
            offset: 0,
          },
          startIndices: new Uint16Array(startIndices),
          getColor: {
            value: new Float32Array(binaryFeatures.colors.value),
            size: binaryFeatures.colors.size,
            stride: BYTE_SIZE * binaryFeatures.colors.size
          },
        },
        individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
      },
      pickable: this.currentLayer === LayerTypes.PathLayer,
      visible: this.currentLayer === LayerTypes.PathLayer,
      positionFormat: "XY",
      _pathType: 'open',
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer,
      },
    });
  }
  // This layer needs an adjustable radius, color, and opacity.
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
      radiusScale: 30,
      getRadius: 4,
      opacity: 0.8,
      radiusMinPixels: 1.0,
      getFillColor: [255, 0, 30],
      autoHighlight: true,
      pickable: this.currentLayer === LayerTypes.ScatterplotLayer,
      visible: this.currentLayer === LayerTypes.ScatterplotLayer,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  // BUG:This layer currently always fallbacks to CPU aggregation slowing down the UI.
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
      visible: this.currentLayer === LayerTypes.HeatmapLayer,
      getWeight: 1,
      debounceTimeout: 1000 * 1, // TODO: This needs to adjusted.
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  // TODO: Include adjustable settings for max elevation, colors, and hexagon dimensions such as width.
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
      pickable: this.currentLayer === LayerTypes.HexagonLayer,
      visible: this.currentLayer === LayerTypes.HexagonLayer,
      autoHighlight: true,
      extruded: true,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      },
    });
  }

  createGridLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;
    return new GridLayer({
      id: `${LayerTypes.GridLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: { // TODO:Check if aggregation is supported with binary data.
          getPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0,
          }
        },
        individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier)
      },
      pickable: this.currentLayer === LayerTypes.GridLayer,
      visible: this.currentLayer === LayerTypes.GridLayer,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer,
      },
    })
  }


  createScreenGridLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    return new ScreenGridLayer({
      id: `${LayerTypes.ScreenGridLayer}-${layerId}`,
      data: {
        length: binaryFeatures.length,
        attributes: {
          getPosition: {
            value: new Float32Array(positions.value),
            size: positionSize,
            stride: entrySize,
            offset: 0,
          }
        },
        individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier),
      },
      pickable: this.currentLayer === LayerTypes.ScreenGridLayer,
      visible: this.currentLayer === LayerTypes.ScreenGridLayer,
      cellSizePixels: 20, // TODO: Make this adjustable.
      opacity: 0.8,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer,
      }
    });
  }

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
      autoHighlight: true,
      opacity: .8,
      getWidth: 3,
      widthMinPixels: 1,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    });
  }

  getColorHelper(animal: string): [Color, Color] {
    const color = this.individualColors.get(animal);
    if (color !== undefined) {
      return color;
    }
    const newColor = [randomColor(), randomColor()] as [Color, Color];
    this.individualColors.set(animal, newColor);
    return newColor;
  }

// TODO: Implement this layer as a the path layer in the tracker view component.
// This should default to a path layer.
// createGeoJsonLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
//   const placeholders = this.BinaryFeaturesPlaceholder();
//   return new GeoJsonLayer({
//     id: `${LayerTypes.GeoJsonLayer}-${layerId}`,
//     data: { lines: binaryFeatures, points: placeholders[0], polygons: placeholders[1] },
//     pointType: "circle",
//     stroked: true,
//     filled: true,
//     colorFormat: "RGBA",
//     getFillColor: [160, 160, 180, 200],
//     getLineColor: this.getColorHelper(binaryFeatures.individualLocalIdentifier)[0],
//     getLineWidth: 1,
//     lineWidthMinPixels: 1,
//     autoHighlight: true,
//     pickable: this.currentLayer === LayerTypes.GeoJsonLayer || this.currentLayer === LayerTypes.PathLayer,
//     visible: this.currentLayer === LayerTypes.GeoJsonLayer || this.currentLayer === LayerTypes.PathLayer,
//     updateTriggers: {
//       visible: this.currentLayer,
//       pickable: this.currentLayer
//     }
//   })
// }


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
