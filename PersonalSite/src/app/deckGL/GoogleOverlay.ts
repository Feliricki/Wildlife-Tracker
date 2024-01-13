import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
// import { TripsLayer } from '@deck.gl/geo-layers/typed';
// import type * as LayerProps from '@deck.gl/core/typed';
import { ArcLayer, GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers/typed';
import { PickingInfo, Layer, Color } from '@deck.gl/core/typed';
import { randomColor } from './deck-gl.worker';
import { LineStringPropertiesV2, PointProperties } from "./GeoJsonTypes";
import { BinaryLineStringResponse, NumericPropsResponse, OptionalAttributes, WorkerFetchRequest } from "./MessageTypes";
import { EventRequest } from "../studies/EventRequest";
import { BinaryLineFeatures, BinaryPointFeatures, BinaryPolygonFeatures, BinaryAttribute } from '@loaders.gl/schema';


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

  textDecoder = new TextDecoder();
  textEncoder = new TextEncoder();

  currentAnimals = new Map<string, [Color, Color]>();

  constructor(map: google.maps.Map) {
    this.map = map;
    console.log("About to start connection to signalr hub");

    if (typeof Worker !== 'undefined') {
      // this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url), { type: "classic"});
      this.webWorker = new Worker(new URL('./deck-gl.worker', import.meta.url));
      console.log(this.webWorker);
      this.webWorker.onmessage = (message) => {
        switch (message.data.type) {
          case "BinaryLineString":
            this.handleBinaryResponse(message.data as BinaryLineStringResponse<LineStringPropertiesV2>);
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

  loadData(request: EventRequest) {
    console.log("Begun loading event data.");

    this.dataChunks = [];
    this.contentArray = [];
    this.currentAnimals.clear();
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
      // TODO:There need to be a fallback mechanism if webworker are not supported.
      console.log("Web worker not supported.");
      // setData(workerRequest, true);
    }
  }

  renderBinaryTooltip(info: PickingInfo) {
    const index = info.index;
    if (index === -1) {
      return null;
    }
    // console.log(info);
    const text = this.getContentHelper(index, info);
    return text === undefined ? null : { html: text };
  }

  // TODO: 1) Look into flat buffer format.
  // 2) Work needs to be done on setting up grpc client.
  // 3) Looking into adding more layers.
  // INFO:Maybe the layer index should be stored in the optional attributes.
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
      colors: { size: BinaryData.colors.size, value: new Uint8Array(BinaryData.colors.value)},
      individualLocalIdentifier: BinaryData.individualLocalIdentifier,
      numericProps: this.numericPropsHelper(BinaryData.numericProps), // TODO: Process this
      properties: [],
      type: "LineString"
    };
    const [pointsFeatures, polygonFeatures] = this.BinaryResponseHelper();

    this.dataChunks.push({ points: pointsFeatures, lines: binaryLineFeatures, polygons: polygonFeatures });
    this.contentArray.push(binaryLineFeatures.content.contentArray);

    const layers: Layer[] = this.dataChunks.map((chunk, index) => this.createArcLayer(chunk.lines, index));

    console.log(
      `contentArray has ${this.contentArray.length} elements with ${this.contentArray.reduce((acc, arr) => acc + arr.length, 0)}` +
      ` total elements and ${layers.length} layers`);
    this.deckOverlay?.setProps({ layers: layers });
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

  // binaryAttributeHelper(val: BufferAttribute) {
  //   return { size: val.size, value: } as BinaryAttribute;
  // }

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
    });
  }

  createArcLayer(binaryFeatures: BinaryLineFeatures & OptionalAttributes, layerId: number) {
    const BYTE_SIZE = 4;

    const positions = binaryFeatures.positions;
    const positionSize = positions.size;
    const entrySize = positionSize * 2 * BYTE_SIZE;
    // Generate colors on demand.
    const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);
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
          // getSourceColor: {
          //   value: colors.value,
          //   size: colors.size,
          //   stride: colors.size * 2 // 2 is number of bytes in a uint8 array.
          // },
          // getTargetColor: {
          //   value: colors.value,
          //   size: colors.size,
          //   stride: colors.size * 2, // 2 is number of bytes in a uint8 array.
          //   offset: colors.size * 2
          // },
          individualLocalIdentifier: this.textEncoder.encode(binaryFeatures.individualLocalIdentifier)
        }
      },
      getSourceColor: colors[0], // This doesn't need to change after being set.
      getTargetColor: colors[1],
      pickable: true,
      getWidth: 5,
      widthMinPixels: 5,
    });
  }

  getColorHelper(animal: string): [Color, Color] {
    const color = this.currentAnimals.get(animal);
    if (color !== undefined){
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
