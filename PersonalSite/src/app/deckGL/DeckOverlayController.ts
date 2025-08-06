import { GoogleMapsOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
import { Layer, LayerProps, PickingInfo } from '@deck.gl/core/typed';
import { ArcLayerProps } from '@deck.gl/layers/typed';
import { LineLayerProps } from '@deck.gl/layers/typed';
import { PathLayerProps } from '@deck.gl/layers/typed';
import { ScatterplotLayerProps } from '@deck.gl/layers/typed';
import { EventRequest } from "../studies/EventRequest";
import { BinaryAttribute, BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures } from '@loaders.gl/schema';
import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { GridLayerProps, HeatmapLayerProps, HexagonLayerProps, ScreenGridLayerProps } from '@deck.gl/aggregation-layers/typed';
import { EventMetadata } from '../events/EventsMetadata';
import mapboxgl from 'mapbox-gl';
import { ControlChange } from '../events/animal-data-panel.component';
import { environment } from 'src/environments/environment';
import {
    BinaryAnimalMovementLineResponse,
    AnimalMovementEvent,
    DeckGlRenderingAttributes,
    MovementDataFetchRequest,
    AnimalMovementLineCollection
} from './deckgl-types';
import { LayerFactory } from './layer-factory';
import { DataProcessor } from './data-processor';
import { handleFeatures } from './deck-gl.worker';


type Color = [number, number, number] | [number, number, number, number];

// This is the type returned by the geoJsonToBinary function.
type BinaryFeatureWithAttributes = {
  points?: BinaryPointFeatures;
  lines: BinaryLineFeatures & DeckGlRenderingAttributes;
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
  cumulativeData: BinaryAnimalMovementLineResponse<object> =
    DataProcessor.emptyBinaryAnimalMovementLineResponse("AggregatedEvents");

  handleBinaryResponse(binaryData: BinaryAnimalMovementLineResponse<AnimalMovementEvent>): void {
    const binaryLineFeatures = DataProcessor.processBinaryData(binaryData);
    const [pointsFeatures, polygonFeatures] = DataProcessor.BinaryFeaturesPlaceholder();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    this.contentArray.push(binaryLineFeatures.content.contentArray);

    this.currentIndividuals.update(prev => {
      prev.add(binaryLineFeatures.individualLocalIdentifier);
      return prev;
    });

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
      layers = [this.createActiveLayer(
        this.currentLayer,
                    DataProcessor.processBinaryData(this.cumulativeData as BinaryAnimalMovementLineResponse<AnimalMovementEvent>), 0)];
    } else {
      layers = this.dataChunks.map((chunk, index) => this.createActiveLayer(this.currentLayer, chunk.lines, index));
    }

    this.currentLayers = layers;
    this.deckOverlay?.setProps({
      layers: layers
    });
  }

  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  currentLayers: Array<Layer | null> = [];
  contentArray: ArrayBufferLike[][] = [];

  // INFO:Store the current state of the controller
  streamStatus: WritableSignal<StreamStatus> = signal("standby");
  individualColors = new Map<string, [Color, Color]>();
  currentIndividuals: WritableSignal<Set<string>> = signal(new Set());

  currentLayer: LayerTypes = LayerTypes.LineLayer;
  currentData: Array<BinaryLineFeatures & DeckGlRenderingAttributes> = [];
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
    this.cumulativeData = DataProcessor.emptyBinaryAnimalMovementLineResponse("AggregatedEvents");

    if (typeof Worker !== 'undefined') {
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));

      this.webWorker.onmessage = (message) => {
        switch (message.data.type) {

          case "BinaryLineString":
            this.cumulativeData = DataProcessor.mergeBinaryResponse(this.cumulativeData, message.data as BinaryAnimalMovementLineResponse<AnimalMovementEvent>);
            this.handleBinaryResponse(message.data as BinaryAnimalMovementLineResponse<AnimalMovementEvent>);
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
    this.cumulativeData = DataProcessor.emptyBinaryAnimalMovementLineResponse("AggregatedEvents");
    LayerFactory.clearColors();
    this.currentMetaData.set(structuredClone(this.MetadataDefaultOptions));
    this.currentIndividuals.set(new Set());
    this.deckOverlay?.finalize();
    
    // Clean up web worker connections
    if (this.webWorker) {
      this.webWorker.postMessage({ type: "Cleanup" });
    }
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

    const workerRequest: MovementDataFetchRequest = {
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

        for (const response of lineStringResponse){
          if (response === null) continue;
          this.cumulativeData = DataProcessor.mergeBinaryResponse(this.cumulativeData, response[0]);
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

      const collections = await response.json() as Array<AnimalMovementLineCollection<AnimalMovementEvent>>;

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
          DataProcessor.processBinaryData(this.cumulativeData as BinaryAnimalMovementLineResponse<AnimalMovementEvent>), 0)
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

  createActiveLayer(layer: LayerTypes, data: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): Layer | null {
    this.currentLayer = layer;
    const newLayer = LayerFactory.createLayer(layer, data, layerId);
    if (newLayer) {
        return newLayer.clone({
            visible: this.currentLayer === layer,
            pickable: this.currentLayer === layer
        });
    }
    return newLayer;
  }

  getCoordinateHelper(info: PickingInfo) {
    return `position: ${info.coordinate}`;
  }

}
