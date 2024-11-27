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
import { handleFeatures, randomColor } from './deck-gl.worker';
import { LineStringFeatureCollection, LineStringPropertiesV2 } from "./GeoJsonTypes";
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
import { environment } from 'src/environments/environment';

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

// NOTE:This files needs to be renamed when mapbox is used as a basemap.
export enum LayerTypes {
  ArcLayer, // 0
  ContourLayer,
  GeoJsonLayer,
  GPUGridLayer,
  GridLayer,
  HeatmapLayer, // 5
  HexagonLayer, // 6
  IconLayer,
  LineLayer,
  PointCloudLayer,
  PathLayer,
  ScatterplotLayer,
  ScenegraphLayer,
  ScreenGridLayer, // 13
  TerrainLayer,
  TextLayer,
  TileLayer,
  Tile3DLayer,
  TripsLayer,
  WMSLayer,
}

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

  // Unused
  readonly colorRange: Color[] = [
    [1, 152, 189],
    [73, 227, 206],
    [216, 254, 181],
    [254, 237, 177],
    [254, 173, 84],
    [209, 55, 78]
  ];

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
  cumulativeData: BinaryLineStringResponse<object> =
    this.emptyBinaryLineStringResponse("AggregatedEvents");

  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  currentLayers: Array<Layer | null> = [];
  contentArray: ArrayBufferLike[][] = [];

  // INFO:Store the current state of the controller
  streamStatus: WritableSignal<StreamStatus> = signal("standby");
  individualColors = new Map<string, [Color, Color]>();
  currentIndividuals: WritableSignal<Set<string>> = signal(new Set());

  currentLayer: LayerTypes = LayerTypes.LineLayer;
  currentData: Array<BinaryLineFeatures & OptionalAttributes> = [];
  // aggregationLayerActive: WritableSignal<boolean> = signal(false);

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
            this.cumulativeData = this.mergeBinaryResponse(this.cumulativeData, message.data as BinaryLineStringResponse<LineStringPropertiesV2>);
            this.handleBinaryResponse(message.data as BinaryLineStringResponse<LineStringPropertiesV2>);
            break;

          // TODO:
          // Target: (n^2) runtime. O(n) space complexity
          // This causes memory usage to rise
          // case "AggregatedEvents":
          //   break;

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
      // NOTE:Fallback to fetch api.
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
    this.cumulativeData = this.emptyBinaryLineStringResponse("AggregatedEvents");
    this.individualColors.clear();
    this.currentMetaData.set(structuredClone(this.MetadataDefaultOptions));
    this.currentIndividuals.set(new Set());
    this.deckOverlay?.finalize();

    console.log("Releasing all release in deckOvelayController.");
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

  // NOTE:This method is responsible for responding to user input from the control panel.
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

    // if (this.webWorker !== undefined) {
    if (this.webWorker !== undefined) {
      this.webWorker.postMessage({ data: workerRequest, type: "FetchRequest" as const });
    }
    else {

      this.sendFetchRequest(request).then(lineStringResponse => {
        if (lineStringResponse === null) return;
        // const responses = lineStringResponse as Array<[BinaryLineStringResponse<LineStringPropertiesV2>, ArrayBufferLike[]]>;

        for (const response of lineStringResponse){
          if (response === null) continue;
          this.cumulativeData = this.mergeBinaryResponse(this.cumulativeData, response[0]);
          this.handleBinaryResponse(response[0]);
        }
      });
    }
    return this.deckOverlay;
  }

  async sendFetchRequest(request: EventRequest)
  {
    try {

      const response = await fetch(environment.baseUrl + "api/MoveBank/GetEventData", {
        method: "POST",
        headers: {
          'Accept': 'application/json, text/plain',
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
          studyId: request.StudyId,
          localIdentifiers: request.LocalIdentifiers,
          sensorType: request.SensorType,
          geometryType: request.GeometryType,
          options: {
            eventProfiles: request.Options.EventProfile
          }
        })
      });

      const collections = await response.json() as Array<LineStringFeatureCollection<LineStringPropertiesV2>>;

      // BUG:Type Error: map is not a function
      const lineStringResponses = collections.map((collection, index) => {
        return handleFeatures({
          features: collection.features,
          individualLocalIdentifier: "N/A",
          count: collection.features.length,
          index: index,
        }, "BinaryLineString");
      });

      return await Promise.all(lineStringResponses);

    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // TODO: This method needs to be refactored to display different information depending the currently active layer.
  // Aggregation layers need to display different information.
  renderTooltip(info: PickingInfo) {
    const index = info.index;
    if (index === -1 || !this.tooltipEnabled) {
      return null;
    }
    const text = this.getContentHelper(index, info);
    return text === undefined ? null : { html: text };
  }

  getContentHelper(index: number, info: PickingInfo): string | undefined {
    const layerIndex = Number(info.layer?.id.split('-').at(1));
    const layerType = Number(info.layer?.id.split('-').at(0));
    if (layerIndex === undefined) {
      return;
    }

    // Consider sending coordinate data to the front end.
    if (layerType === LayerTypes.ScatterplotLayer) {
      return `
        <h5>Coordinates</h5>
        <p>Longitude: ${info.coordinate?.at(0)}</p>
        <p>Latitude: ${info.coordinate?.at(1)}</p>
      `;
    }
    else if (layerType === LayerTypes.HexagonLayer){
      const layerObject = info.object as { points: unknown[] };
      return `
        <p>Events: ${layerObject.points.length}</p>
      `;
    }
    else if (layerType === LayerTypes.ScreenGridLayer){
      const layerObject = info.object as { cellCount: number };
      return `
        <p>Events: ${layerObject.cellCount}</p>
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

  // TODO:This needs to be changed to handle aggregation layers.
  changeActiveLayer(layer: LayerTypes): void {
    if (this.currentLayer === layer) return;
    this.currentLayer = layer;
    if (this.dataChunks.length === 0) return;

    let layers: Array<Layer<object> | null> = [];
    if (this.isAggregationLayer(layer)) {
      layers = [
        this.createActiveLayer(
          layer,
          this.processBinaryData(this.cumulativeData as BinaryLineStringResponse<LineStringPropertiesV2>), 0)
      ];

    } else {
      layers = this.dataChunks
        .map((chunk, index) => this.createActiveLayer(layer, chunk.lines, index));
    }
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

      // NOTE:Heatmap layer is temporarily removed until it stops falling back to CPU aggregation.
      case LayerTypes.HeatmapLayer:
        return this.createHeatmapLayer(data, layerId);
      default:
        return null;
    }
  }

  getCoordinateHelper(info: PickingInfo) {
    return `position: ${info.coordinate}`;
  }

  // TODO:This method will merge the incoming chunks of data and merge them with the stored cumulative data.
  // INFO:Target runtime: O(n) space complexity: O(n)
  mergeBinaryResponse(prev: BinaryLineStringResponse<object>, cur: BinaryLineStringResponse<LineStringPropertiesV2>)
    : BinaryLineStringResponse<LineStringPropertiesV2> {
    if (prev.length === 0) {
      return cur;
    }

    const prevPositions = new Float32Array(prev.position.value);
    const curPositions = new Float32Array(cur.position.value);
    const mergedPositions = {
      size: cur.position.size,
      value: new Float32Array(prevPositions.length + curPositions.length) // NOTE: This constructor allocated the needed memory.
    };
    mergedPositions.value.set(prevPositions);
    mergedPositions.value.set(curPositions, prevPositions.length);

    const prevPathIndices = new Uint16Array(prev.pathIndices.value);
    const curPathIndices = new Uint16Array(cur.pathIndices.value);
    const mergedPathIndices = {
      size: cur.pathIndices.size,
      value: new Uint16Array(prevPathIndices.length + curPathIndices.length),
    };
    mergedPathIndices.value.set(prevPathIndices);
    mergedPathIndices.value.set(curPathIndices, prevPathIndices.length);

    return {
      type: "AggregatedEvents",
      featureId: cur.featureId,
      globalFeatureIds: cur.globalFeatureIds,
      position: mergedPositions,
      index: 0,
      pathIndices: mergedPathIndices,
      length: prev.length + cur.length,
      content: cur.content,
      colors: cur.colors,
      individualLocalIdentifier: "N/A",
      numericProps: cur.numericProps,
    };
  }

  processBinaryData(binaryData: BinaryLineStringResponse<LineStringPropertiesV2>): BinaryLineFeatures & OptionalAttributes {
    const binaryLineFeatures: BinaryLineFeatures & OptionalAttributes = {
      type: "LineString",
      featureIds: { size: binaryData.featureId.size, value: new Uint16Array(binaryData.featureId.value) },
      globalFeatureIds: { size: binaryData.globalFeatureIds.size, value: new Uint16Array(binaryData.globalFeatureIds.value) },
      positions: { size: binaryData.position.size, value: new Float32Array(binaryData.position.value) },
      pathIndices: { size: binaryData.pathIndices.size, value: new Uint16Array(binaryData.pathIndices.value) },
      length: binaryData.length,
      content: binaryData.content,
      colors: { size: binaryData.colors.size, value: new Uint8Array(binaryData.colors.value) },
      individualLocalIdentifier: binaryData.individualLocalIdentifier,
      numericProps: this.numericPropsHelper(binaryData.numericProps),
      properties: [],
    };
    return binaryLineFeatures;
  }

  // NOTE: This method is called when the web worker finishes processing the requested event data.
  handleBinaryResponse(binaryData: BinaryLineStringResponse<LineStringPropertiesV2>): void {
    const binaryLineFeatures = this.processBinaryData(binaryData);
    const [pointsFeatures, polygonFeatures] = this.BinaryFeaturesPlaceholder();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    this.contentArray.push(binaryLineFeatures.content.contentArray);

    this.currentIndividuals.update(prev => {
      prev.add(binaryLineFeatures.individualLocalIdentifier);
      return prev;
    });

    // console.log(`Current number of individuals is ${this.currentIndividuals().size}`);

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


    let layers: Array<Layer<object> | null> = [];
    if (this.isAggregationLayer(this.currentLayer)) {
      // TODO:Test this function using various aggregation layers.
      // NOTE: All of the positions and pathIndices up unitl this point are used in a single layer.
      // console.log("Creating aggregation layer in deckOverlaycontroller");
      layers = [this.createActiveLayer(
        this.currentLayer,
        this.processBinaryData(this.cumulativeData as BinaryLineStringResponse<LineStringPropertiesV2>), 0)];
    } else {
      layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(this.currentLayer, chunk.lines, index));
    }

    this.currentLayers = layers;
    this.deckOverlay?.setProps({
      layers: layers
    });
  }

  setAppropriateLayers() {
    return;
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
      radiusPixels: 30,
      intensity: 1,
      threshold: 0.3,
      // weightsTextureSize: 512,
      visible: this.currentLayer === LayerTypes.HeatmapLayer,
      getWeight: 1,
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
      elevationRange: [0, 3000] as [number, number],
      radius: 1000,
      // colorRange: this.colorRange,
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

  // TODO: Look up the actual values for the typedArrays by printing the
  // messagePack parsed values on the .
  emptyBinaryLineStringResponse(
    responseType: "BinaryLineString" | "AggregatedEvents"
  ): BinaryLineStringResponse<object> {
    return {
      type: responseType,
      index: 0,
      length: 0,
      individualLocalIdentifier: "none",
      featureId: { size: 3, value: new Uint8Array() },
      globalFeatureIds: { size: 3, value: new Uint16Array() },
      pathIndices: { size: 3, value: new Int8Array() },
      numericProps: {
        distanceTravelledKm: { size: 3, value: new Float64Array() },
        sourceTimestamp: { size: 3, value: new Float64Array() },
        destinationTimestamp: { size: 3, value: new Float64Array() },
        distanceKm: { size: 3, value: new Float64Array() },
      },
      position: { size: 3, value: new Float32Array() },
      colors: { size: 3, value: new Uint8Array() },
      content: { contentArray: [] }
    };
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
