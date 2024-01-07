import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
// import { TripsLayer } from '@deck.gl/geo-layers/typed';
// import type * as LayerProps from '@deck.gl/core/typed';
import { ArcLayer, GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers/typed';
import { PickingInfo, Layer } from '@deck.gl/core/typed';
import { randomColor, setData } from './deck-gl.worker';
import { PointProperties } from "./GeoJsonTypes";
import { BinaryLineStringResponse, OptionalAttributes, WorkerFetchRequest } from "./MessageTypes";
import { EventRequest } from "../studies/EventRequest";
import { BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures } from '@loaders.gl/schema';
// import { GL } from '@luma.gl/constants';


type LayerId = string;
type BinaryFeatureWithAttributes = {
  points?: BinaryPointFeatures;
  lines: BinaryLineFeatures & OptionalAttributes;
  polygons?: BinaryPolygonFeatures;
};

export class GoogleMapOverlayController {
  map: google.maps.Map;
  deckOverlay?: DeckOverlay | MapboxOverlay;

  // INFO: A layer is created for each individual.
  geoJsonLineLayers = new Map<LayerId, GeoJsonLayer<GeoJsonLayerProps>>;
  arcLineLayers = new Map<LayerId, ArcLayer<object>>;
  pointGeoJsonLayers = new Map<LayerId, GeoJsonLayer<PointProperties>>;

  visibleLayers = {
    geoJsonPath: false,
    scatterPlot: false,
  };

  webWorker?: Worker;

  dataChunks: Array<BinaryFeatureWithAttributes> = [];
  contentArray: ArrayBufferLike[][] = [];
  // contentMap: Map<number, ArrayBufferLike[]> = new Map<number, ArrayBufferLike[]>;

  textDecoder = new TextDecoder();

  // TODO: Refactor this to use a suitable data source that be updated without clearing all of the layers.
  // NOTE:  Switching to a new event source will require a complete reload of all entities but
  // fetching more data from a specific individual should not. (the data source can be updated with more entities to
  // avoid another api request and layer instantiation.)
  // It may be better to request an array of features from the backend and then create geojsonlayers from each individual array response.

  constructor(map: google.maps.Map) {
    this.map = map;
    if (typeof Worker !== 'undefined') {
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));
      this.webWorker.onmessage = (message) => {
        switch (message.data.type) {
          case "BinaryLineString":
            this.handleBinaryResponse(message.data as BinaryLineStringResponse);
            break;

          default:
            return;
        }
      }

    } else {
      console.error("Web worker api not supported.");
    }
  }

  loadData(request: EventRequest) {
    this.dataChunks = [];
    this.contentArray = [];
    this.deckOverlay?.finalize();

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
      setData(workerRequest, true);
    }
  }

  renderBinaryTooltip(info: PickingInfo) {
    const index = info.index;
    if (index === -1) {
      return null;
    }
    console.log(info);
    console.log(`Hovering over layer index = ${index}`);

    const text = this.getContentHelper(index, info);
    return text === undefined ? null : { html: text };

  }

  // TODO: 1) Look into flat buffer format.
  // 2) Work needs to be done on setting up grpc client.
  // 3) Looking into adding more layers.

  // INFO:Maybe the layer index should be stored in the optional attributes.
  getContentHelper(index: number, info: PickingInfo): string | undefined {
    const layerIndex = Number(info.layer?.id.split('-').at(1));
    if (layerIndex === undefined){
      return;
    }
    const content = this.contentArray.at(layerIndex)?.at(index);

    if (content === undefined){
      return;
    }

    const text = this.textDecoder.decode(new Uint8Array(content));
    return text;
  }

  getCoordinateHelper(info: PickingInfo) {
    return `position: ${info.coordinate}`;
  }
  // TODO: Send flatten numeric props such as color before sending the ddata to the mainthread.

  // NOTE: This method is called when the web worker finishes processing the requested event data.
  // The expensive part is handle the loading and parsing of the event request.
  handleBinaryResponse(data: BinaryLineStringResponse): void {

    const binaryLineFeatures: BinaryLineFeatures & OptionalAttributes = {
      featureIds: { size: data.featureId.size, value: new Uint16Array(data.featureId.value) },
      globalFeatureIds: { size: data.globalFeatureIds.size, value: new Uint16Array(data.globalFeatureIds.value) },
      positions: { size: data.position.size, value: new Float32Array(data.position.value) },
      pathIndices: { size: data.pathIndices.size, value: new Uint16Array(data.pathIndices.value) },
      length: data.length,
      content: data.content,
      numericProps: {},
      properties: [],
      type: "LineString"
    };
    const [pointsFeatures, polygonFeatures] = this.BinaryResponseHelper();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    this.contentArray.push(binaryLineFeatures.content.contentArray);
    const layers: Layer[] = this.dataChunks.map((chunk, index) => this.createArcLayer(chunk.lines, index));

    console.log(
      `contentArray has ${this.contentArray.length} elements with ${this.contentArray.reduce((acc, arr) => acc + arr.length, 0)}`+
      ` total elements and ${layers.length} layers`);
    this.deckOverlay?.setProps({ layers: layers });
  }

  // NOTE: This helper method builds an empty points and line binaryFeaturesObjects.
  BinaryResponseHelper(): [BinaryPointFeatures, BinaryPolygonFeatures] {
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

  // TODO: The color should be retrieved from the backend or generated with a function.
  // Work on random color generatoer
  createGeoJsonLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    // console.log(binaryFeatures);
    return new GeoJsonLayer({
      id: `geojson-${layerId}`,
      data: binaryFeatures,
      pickable: true,
      stroked: true,
      filled: true,
      colorFormat: "RGBA",
      getFillColor: [250, 0, 0, 255], // Red
      getLineColor: randomColor(),
      lineWidthMinPixels: 5,
      getLineWidth: 10,
      // onHover: info => this.renderTooltip(info)
    });
  }

  createArcLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * 4;
    // Generate colors on demand.
    const color1 = randomColor();
    const color2 = randomColor();
    return new ArcLayer({
      id: `arclayer-${layerId}`,
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
            offset: entrySize / 2,
          },
        }
      },
      pickable: true,
      getWidth: 5,
      widthMinPixels: 5,
      getSourceColor: color1,
      getTargetColor: color2,
    });
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
// const positionArray = new Float32Array(lineFeatures.positions.value); const positionSize = lineFeatures.positions.size; const positionIndices = new Uint16Array(lineFeatures.pathIndices.value); NOTE: There is also a z-axis number with a +2 offset that is currently unused. const sourceLong = positionArray[index * positionSize * 2]; const sourceLat = positionArray[index * positionSize * 2 + 1]; const nextLong = positionArray.at(index * positionSize * 2 + positionSize)!; const nextLat = positionArray.at(index * positionSize * 2 + positionSize + 1)!; console.log(`sourcePosition: [${sourceLong}, ${sourceLat}]`); console.log(`nextPosition: [${nextLong}, ${nextLat}]`);
