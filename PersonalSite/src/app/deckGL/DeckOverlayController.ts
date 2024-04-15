import { GoogleMapsOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
// import { TripsLayer } from '@deck.gl/geo-layers/typed';
import {
  ArcLayer,
  ArcLayerProps,
  LineLayer,
  LineLayerProps,
  PathLayer,
  PathLayerProps,
  ScatterplotLayer,
  ScatterplotLayerProps
} from '@deck.gl/layers/typed';
import { Color, Layer, LayerProps, PickingInfo } from '@deck.gl/core/typed';
import { randomColor } from './deck-gl.worker';
import { LineStringPropertiesV2 } from "./GeoJsonTypes";
import { BinaryLineStringResponse, NumericPropsResponse, OptionalAttributes, WorkerFetchRequest } from "./MessageTypes";
import { EventRequest } from "../studies/EventRequest";
import { BinaryAttribute, BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures } from '@loaders.gl/schema';
import { computed, Signal, signal, WritableSignal } from '@angular/core';
import {
  GridLayer,
  GridLayerProps,
  HeatmapLayer,
  HeatmapLayerProps,
  HexagonLayer,
  HexagonLayerProps,
  ScreenGridLayer,
  ScreenGridLayerProps
} from '@deck.gl/aggregation-layers/typed';
import { EventMetadata } from '../events/EventsMetadata';
import mapboxgl from 'mapbox-gl';
import { ControlChange } from '../events/events.component';

// This is the type returned by the geoJsonToBinary function.
type BinaryFeatureWithAttributes = {
  points?: BinaryPointFeatures;
  lines: BinaryLineFeatures & OptionalAttributes;
  polygons?: BinaryPolygonFeatures;
};

type GoogleBaseMap = {
  type: "google";
  map: google.maps.Map;
}

type MapboxBaseMap = {
  type: "mapbox";
  map: mapboxgl.Map;
}

type PointLayerProps = Partial<ScatterplotLayerProps>;
type PathLikeLayerProps = Partial<PathLayerProps & LineLayerProps & ArcLayerProps>;
type AggregationLayerProps = Partial<HexagonLayerProps & ScreenGridLayerProps & GridLayerProps>;

type OverlayTypes = "google" | "mapbox" | "arcgis";

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
  type: "path";

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
  type: "point";

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
  type: "aggregation";

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

export class DeckOverlayController {
  map: google.maps.Map | mapboxgl.Map;
  deckOverlay?: GoogleMapsOverlay | MapboxOverlay;
  currentActiveOverlay: WritableSignal<OverlayTypes> = signal("google");
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

  // TODO:Consider if received chunks can appended to their corresponding layer going by individual.
  // If it's possible to pull this off then I should consider making a layer for each individual
  // and one large layer containing all the individual's event data.
  cumulativeData: BinaryLineStringResponse<LineStringPropertiesV2> | undefined;

  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  currentLayers: Array<Layer | null> = [];
  contentArray: ArrayBufferLike[][] = [];

  streamStatus: WritableSignal<StreamStatus> = signal("standby");
  individualColors = new Map<string, [Color, Color]>();
  currentIndividuals: WritableSignal<Set<string>> = signal(new Set());

  currentLayer: LayerTypes = LayerTypes.LineLayer;
  currentData: Array<BinaryLineFeatures & OptionalAttributes> = [];

  tooltipEnabled: boolean = true;

  // TODO:Test how these default settings function for the current layers.
  defaultBaseLayerOptions: Partial<LayerProps> = {
    autoHighlight: false,
    transitions: {} // Consider using this down the line.
  }

  defaultPointOptions: Partial<ScatterplotLayerProps> = {
    radiusUnits: 'meters',
    radiusScale: 1,
    lineWidthUnits: 'meters',
    // lineWidthScale: 30,
    // stroked: false,
    // filled: true,
    autoHighlight: true,
    radiusMinPixels: 1.0,
    // radiusMaxPixels: Number.MAX_SAFE_INTEGER,
    // billboard: false,
    // antialiasing: false,
    // getRadius: 1,
    // opacity: 0.8,
    opacity: 1.0,
    // getColor: undefined,
    // getFillColor: undefined,
    // getLineColor: undefined,
    // getLineWidth: 1,
  }

  // TODO:Add the trips layer.
  defaultPathOptions: Partial<ArcLayerProps & LineLayerProps & PathLayerProps> = {
    // NOTE: Arc Layer Specific Options
    // numSegments: 50,
    // greatCircle: false,
    // getHeight: 1,
    //
    // getSourceColor: undefined,
    // getTargetColor: undefined,
    //
    // getSourcePosition: undefined,
    // getTargetPosition: undefined,
    //
    // getTilt: 0, // -90 to 90
    //
    // // NOTE:Path Layer Specific Options
    // getPath: undefined,
    // getColor: undefined,
    // capRounded: false,
    // billboard: false, // if true, the path always faces the screen.
    // miterLimit: 4, // Only applicable if roundedJoint = false.
    // _pathType: "open", // If loop or open then the overlay will skip normalization.
    //
    // // NOTE:General Path Options
    // autoHighlight: true,
    widthUnits: "pixels",
    widthScale: 1,
    getWidth: 1, // default = 1
    // widthMinPixels: 1, // default = 0
    opacity: 1.0, // default = 1
  }

  defaultAggregationOptions: Partial<HeatmapLayerProps & HexagonLayerProps & ScreenGridLayerProps & GridLayerProps> = {
    // INFO: Hexagon specific options
    radius: 1000,
    coverage: 1,

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

  readonly MetadataDefaultOptions: EventMetadata = {
    layer: this.currentLayer,
    numberOfEvents: 0,
    numberOfIndividuals: 0,
    currentIndividuals: new Set(),
    focusedIndividual: "",
    pathWidth: 3,
    widthUnits: 'pixel',
    textLayer: false,
  };

  currentMetaData: WritableSignal<EventMetadata> = signal(
    {
      layer: this.currentLayer,
      numberOfEvents: 0,
      numberOfIndividuals: 0,
      currentIndividuals: new Set(),
      focusedIndividual: "",
      pathWidth: 3,
      widthUnits: 'pixel',
      textLayer: false,
    }
  );


  constructor(map: google.maps.Map | mapboxgl.Map, layer: LayerTypes) {
    this.map = map;
    this.currentLayer = layer;

    if (typeof Worker !== 'undefined') {
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));

      this.webWorker.onmessage = (message) => {
        switch (message.data.type) {

          case "BinaryLineString":
            this.handleBinaryResponse(message.data as BinaryLineStringResponse<LineStringPropertiesV2>);
            break;

            // TODO:Implement this case.
          case "AggregatedEvents":

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

  releaseResources(): void {
    this.dataChunks = [];
    this.contentArray = [];
    this.currentLayers = [];
    this.individualColors.clear();
    this.currentMetaData.set(structuredClone(this.MetadataDefaultOptions));
    this.currentIndividuals.set(new Set());
    this.deckOverlay?.finalize();
  }

  createOverlay(overlayType: OverlayTypes): GoogleMapsOverlay | MapboxOverlay {
    switch (overlayType) {
      case "google":
        return new GoogleMapsOverlay({
          getTooltip: (data) => data.layer && this.renderTooltip(data),
          _typedArrayManagerProps: {
            overAlloc: 1,
            poolSize: 0,
          }
        });

      case "mapbox":
        // NOTE:This overlay implement the IController class from the mapbox imports and must be added in the original mapbox component class.
        return new MapboxOverlay({
          interleaved: false, //NOTE:Interleaved option is buggy as of now.
          getTooltip: (data) => data.layer && this.renderTooltip(data),
          _typedArrayManagerProps: {
            overAlloc: 1,
            poolSize: 0,
          }
        });
      case "arcgis":
        // TODO: This needs to be changed to the arcgis overlay later on.
        return new GoogleMapsOverlay({
          getTooltip: (data) => data.layer && this.renderTooltip(data),
          _typedArrayManagerProps: {
            overAlloc: 1,
            poolSize: 0,
          }
        });
    }
  }

  changeOverlayType(overlay: OverlayTypes): void {
    this.releaseResources();
    if (overlay === this.currentActiveOverlay()) return;
    this.currentActiveOverlay.set(overlay);
  }

  setLayerAttributes(change: ControlChange): void {
    // NOTE:These options change the custom settings to pertaining to deck.gl layer props.
    if (change.field === "toggleTooltip") {
      this.setTooltip(change.change.value as boolean);
      return;
    }
    switch (change.formType) {
      case "point":
        this.defaultPointOptions[change.field as keyof PointLayerProps] = change.change.value;
        break;
      case "path":
        this.defaultPathOptions[change.field as keyof PathLikeLayerProps] = change.change.value;
        break;
      case "aggregation":
        this.defaultAggregationOptions[change.field as keyof AggregationLayerProps] = change.change.value;
        break;
    }

    const layers = this.currentLayers.map(layer => {
      if (layer !== null) {
        return this.setLayerAttributesHelper(change, layer);
      }
      return layer;
    });

    this.deckOverlay?.setProps({
      layers: layers
    });
    this.currentLayers = layers;
  }

  setLayerAttributesHelper(change: ControlChange, layer: Layer): Layer {
    return layer.clone({
      [change.field]: change.change.value
    });
  }

  loadData(request: EventRequest, basemap: GoogleBaseMap | MapboxBaseMap):
    GoogleMapsOverlay | MapboxOverlay | undefined {
    this.releaseResources();
    this.streamStatus.set("streaming");

    this.currentActiveOverlay.set(basemap.type);
    if (basemap.type == "google") {
      this.deckOverlay = this.createOverlay(this.currentActiveOverlay()) as GoogleMapsOverlay;
      this.deckOverlay.setMap(basemap.map);
    }
    else if (basemap.type === "mapbox") {
      // NOTE:MapboxOverlay implements the IControl interface used for custom controls for Mapbox's map.
      this.deckOverlay = this.createOverlay(this.currentActiveOverlay()) as MapboxOverlay;
      basemap.map.addControl(this.deckOverlay);
    }

    const workerRequest: WorkerFetchRequest = {
      type: "FetchRequest",
      request: request,
    };

    if (this.webWorker !== undefined) {
      this.webWorker.postMessage({ data: workerRequest, type: "FetchRequest" as const });
    }
    else {
      alert("Your browser does not support webworkers.");
    }
    return this.deckOverlay;
  }

  // TODO: This method needs to be refactored to display different information depending the currently active layer.
  renderTooltip(info: PickingInfo) {
    const index = info.index;
    if (index === -1 || !this.tooltipEnabled) {
      return null;
    }
    const text = this.getContentHelper(index, info);
    return text === undefined ? null : { html: text };
  }

  // TODO:This needs to be refactored to show different content depending on the current layer.
  getContentHelper(index: number, info: PickingInfo): string | undefined {
    const layerIndex = Number(info.layer?.id.split('-').at(1));
    const layerType = Number(info.layer?.id.split('-').at(0));
    if (layerIndex === undefined) {
      return;
    }

    if (layerType === LayerTypes.ScatterplotLayer) {
      return `
        <h5>Scatterplot Layer</h5>
        <h5>Coordinates</h5>
        <p>Longitude: ${info.coordinate?.at(0)}</p>
        <p>Latitude: ${info.coordinate?.at(1)}</p>
      `;
    }


    const content = this.contentArray.at(layerIndex)?.at(index);
    if (content === undefined) {
      return;
    }

    const text = this.textDecoder.decode(new Uint8Array(content));
    return text;
  }

  setTooltip(value: boolean): void {
    this.tooltipEnabled = value;
  }

  // TODO:This render the latest options selected by the users.
  // Test if the updateTrigger attribute is actually doing something.
  changeActiveLayer(layer: LayerTypes): void {
    if (this.currentLayer === layer) return;
    this.currentLayer = layer;
    if (this.dataChunks.length === 0) return;

    const layers = this.dataChunks
      .map((chunk, index) => this.createActiveLayer(layer, chunk.lines, index));
    this.currentLayers = layers;
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

      // NOTE:Heatmap layer is temporarily removed until it stops falling back to CPU aggregation.
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
      } as EventMetadata;
    });

    // BUG:Aggregation layers needs to be all on the same layer to work properly.
    // This might be fine if individual can be toggled or shown one at time.
    // If this implementation is used, then all individuals should start out at the 'toggled on' state
    // If all user are toggled on then all individuals should belong to the same layer.
    // This will incur a signficant performance penalty on the main thread. This computation should be done on the webworker.
    const layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(this.currentLayer, chunk.lines, index));
    this.currentLayers = layers;

    // console.log(`Overlay has ${this.dataChunks.length} layers with ${this.contentArray.reduce((acc, arr) => acc + arr.length, 0)} total elements.`);
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

  setOptionsHelper(props: LayerProps, layerType: "point" | "path" | "aggregation") {

    let entries = Object.entries(this.defaultPathOptions);
    if (layerType === "point") {
      entries = Object.entries(this.defaultPointOptions);
    } else if (layerType === "path") {
      entries = Object.entries(this.defaultPathOptions);
    } else {
      entries = Object.entries(this.defaultAggregationOptions);
    }
    entries.forEach(([key, value]) => {
      if (layerType === "path") {
        const casted = props as PathLikeLayerProps;
        casted[key as keyof PathLikeLayerProps] = value;
      }
      else if (layerType === "point") {
        const casted = props as PointLayerProps;
        casted[key as keyof PointLayerProps] = value;
      }
      else {
        const casted = props as AggregationLayerProps;
        casted[key as keyof AggregationLayerProps] = value;
      }
    });
  }

  createArcLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;
    const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

    const arcLayerProps: ArcLayerProps =
    {
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
      // getWidth: 3,
      // widthMinPixels: 1,
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    }

    this.setOptionsHelper(arcLayerProps, "path");
    return new ArcLayer(arcLayerProps);
  }
  // INFO: I can forget about this layer for now. Basically the same as line layer.
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

    const pathLayerProps = {
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
    };
    this.setOptionsHelper(pathLayerProps as PathLayerProps, "path");

    return new PathLayer();
  }

  createScatterplotLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const scatterplotProps: ScatterplotLayerProps = {
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
    };
    this.setOptionsHelper(scatterplotProps, "point");
    return new ScatterplotLayer(scatterplotProps);
  }

  // BUG:This layer currently always fallbacks to CPU aggregation slowing down the UI.
  createHeatmapLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const heatmapProps = {
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
      aggregation: "SUM" as const,
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
    };

    return new HeatmapLayer(heatmapProps);
  }

  // TODO: Include adjustable settings for max elevation, colors, and hexagon dimensions such as width.
  createHexagonLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const hexagonLayerProps = {
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
    };
    this.setOptionsHelper(hexagonLayerProps, "aggregation");
    return new HexagonLayer(hexagonLayerProps);
  }

  createGridLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const gridProps = {
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
    };
    this.setOptionsHelper(gridProps, "aggregation");
    return new GridLayer(gridProps);
  }

  createScreenGridLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;

    const screengridProps = {
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
    };

    this.setOptionsHelper(screengridProps, "aggregation");
    return new ScreenGridLayer(screengridProps);
  }

  createLineLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE; // 2 positions *  2 coordinates * number of bytes.
    const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

    const lineLayerProps: LineLayerProps =
    {
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
      updateTriggers: {
        visible: this.currentLayer,
        pickable: this.currentLayer
      }
    }

    this.setOptionsHelper(lineLayerProps, "path");
    return new LineLayer(lineLayerProps);
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
}
