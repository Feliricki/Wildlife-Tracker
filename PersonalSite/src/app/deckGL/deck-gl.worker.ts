/// <reference lib="webworker" />

// import { ArcLayer, GeoJsonLayer } from '@deck.gl/layers/typed';
import { BinaryLineStringResponse, BufferAttribute, ContentBufferArrays, NumericPropsResponse, WorkerFetchRequest } from "./MessageTypes";
import { LineStringFeature, LineStringFeatures, LineStringPropertiesV2 } from "./GeoJsonTypes";
// import { environment } from '../../environments/environment';
import { geojsonToBinary } from '@loaders.gl/gis'
import { BinaryLineFeatures, BinaryAttribute, TypedArray } from '@loaders.gl/schema'
import { NonNumericProps, NumericPropsType } from "./MessageTypes";
import * as signalR from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import * as msgPack from '@msgpack/msgpack';


let streamSubscription: signalR.ISubscription<LineStringFeature<LineStringPropertiesV2>> | null = null;

addEventListener('message', ({ data }) => {

  switch (data.type) {
    case "FetchRequest":
      setData(data.data as WorkerFetchRequest);
      break;

    default:
      console.log("Default case in web worker");
      break;
  }
});

// TODO:Use the fetch api in browser that do not support webworkers.
export async function setData(
  fetchRequest: WorkerFetchRequest,
  mainThread: boolean = false) {
  try {

    console.log(mainThread);

    streamSubscription?.dispose();

    // INFO:The url needs to be remained fixed to work in a webworker.
    // Relative addresses won't work but this url will be proxied.
    const connection: signalR.HubConnection =
      new signalR.HubConnectionBuilder()
        .configureLogging(signalR.LogLevel.Debug)
        .withUrl("https://localhost:4200/api/MoveBank-Hub", { withCredentials: false })
        .withHubProtocol(new MessagePackHubProtocol())
        .withStatefulReconnect()
        .build();

    await connection.start();

    console.log("SignalR connection made in web worker.");

    const streamResponse =
      connection.stream<TypedArray>("StreamEvents", fetchRequest.request);

    streamSubscription = streamResponse.subscribe({
      next: handleFeatures,
      complete: () => {
        console.log("Stream successfully ended.");
        postMessage({
          type: "StreamEnded"
        });
      },
      error: (err: unknown) => {
        console.error(err);
        postMessage({
          type: "StreamError"
        });
      }
    });

  } catch (error) {
    console.error(error);
  }
}


// TODO:Consider if this function can be made into an async iterator so that deck.gl layers
// can be imcrementally loaded.
// This is done by by manually implementing next and return callback functions.
// async function handleFeatures(featuresRes: LineStringFeatures<LineStringPropertiesV2>) {
async function handleFeatures(binaryRes: TypedArray) {

  console.log("Handling new feature in web worker.");
  const decoded = msgPack.decode(binaryRes) as Array<number | string | unknown[]>;
  const featuresRes = parseMsgPackResponse(decoded);
  if (featuresRes.count === 0) return;

  const features = featuresRes.features;

  const binaryFeature = geojsonToBinary(features);
  const binaryLineFeatures = binaryFeature.lines;

  if (binaryLineFeatures === undefined || features.length === 0) return;

  const binaryResponse = createBinaryResponse(
    binaryLineFeatures,
    featuresRes);

  postMessage(binaryResponse[0], binaryResponse[1]);
}

function parseMsgPackResponse(msg: Array<number | string | unknown[]>) {
  const features = msg[0] as object[][];
  const localIdentfier = msg[1] as string;
  const count = msg[2] as number;
  const index = msg[3] as number;

  const parsedFeatures = features.map(parseMsgPackFeature);
  return {
    features: parsedFeatures,
    individualLocalIdentifier: localIdentfier,
    count: count,
    index: index
  } as LineStringFeatures<LineStringPropertiesV2>;
}

function parseMsgPackFeature(feature: Array<object>): LineStringFeature<LineStringPropertiesV2> {
  const geometry = feature[1] as unknown[];
  const properties = feature[2] as (number | string)[];
  const coordinates = geometry[1] as number[][];

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coordinates,
    },
    properties: {
      sourceTimestamp: properties[0],
      destinationTimestamp: properties[1],
      content: properties[2],
      distanceKm: properties[3],
      distanceTravelledKm: properties[4]
    }
  } as LineStringFeature<LineStringPropertiesV2>;
}

// INFO: The following are the current numericProps.
// const numericProps: NumericProps<LineStringPropertiesV2> = {
//   sourceTimestamp: 1n,
//   destinationTimestamp: 1n,
//   distanceKm: 2,
//   distanceTravelledKm: 3,
// };

export function createBinaryResponse(
  binaryLines: BinaryLineFeatures,
  featureRes: LineStringFeatures<LineStringPropertiesV2>):
  [BinaryLineStringResponse<LineStringPropertiesV2>, ArrayBufferLike[]] {

  const properties = binaryLines.properties as NonNumericProps<LineStringPropertiesV2>[];
  const content = extractContent(properties);

  // NOTE: The following returns the object being returns and an array of all the buffers within it.
  const numericPropsPairValue = extractNumericProps(binaryLines.numericProps);
  const response: BinaryLineStringResponse<LineStringPropertiesV2> = {
    type: "BinaryLineString",
    index: featureRes.index,
    length: featureRes.count,
    individualLocalIdentifier: featureRes.individualLocalIdentifier,
    featureId: GetBufferFromBinaryAttribute(binaryLines.featureIds),
    globalFeatureIds: GetBufferFromBinaryAttribute(binaryLines.globalFeatureIds),
    pathIndices: GetBufferFromBinaryAttribute(binaryLines.pathIndices),
    position: GetBufferFromBinaryAttribute(binaryLines.positions),
    colors: generateColors(content.contentArray.length),
    numericProps: numericPropsPairValue[0],
    content: content,
  };

  // NOTE: What gets sent over are the binary line features
  // then the numeric props of the LineStringProperties interface
  // and finally, all the content string encoded into a Uint8Array.
  const buffers = [
    response.featureId.value,
    response.globalFeatureIds.value,
    response.pathIndices.value,
    response.position.value,
    ...numericPropsPairValue[1],
    ...content.contentArray
  ];

  return [response, buffers];
}

// INFO: This functions generates 2*n colors where n is the number of features.
// The purpose is to supply a source and a target color for the arc layer.
export function generateColors(numFeatures: number): BufferAttribute {
  const colors: number[] = [];
  for (let i = 0; i < numFeatures; i++) {
    colors.push(...randomColor());
    colors.push(...randomColor());
  }

  return { size: 4, value: new Uint8Array(colors).buffer };
}

export function extractNumericProps(
  numericProps: { [key: string]: BinaryAttribute }) {

  const castedProps = numericProps as NumericPropsType<LineStringPropertiesV2>;

  const keys = Object.keys(castedProps);
  const buffers = [] as ArrayBufferLike[];
  const map = new Map<string, { size: number, value: ArrayBufferLike }>();

  for (const key of keys) {
    const value = numericProps[key as keyof (typeof castedProps)];
    buffers.push(value.value.buffer);
    map.set(key, { size: value.size, value: value.value.buffer });
  }

  const newObj = {
    sourceTimestamp: {
      size: castedProps.sourceTimestamp.size,
      value: castedProps.sourceTimestamp.value.buffer
    },
    destinationTimestamp: {
      size: castedProps.destinationTimestamp.size,
      value: castedProps.destinationTimestamp.value.buffer
    },
    distanceKm: {
      size: castedProps.distanceKm.size,
      value: castedProps.distanceKm.value.buffer
    },
    distanceTravelledKm: {
      size: castedProps.distanceTravelledKm.size,
      value: castedProps.distanceTravelledKm.value.buffer
    },
  } as NumericPropsResponse<LineStringPropertiesV2>;

  return [newObj, buffers] as [NumericPropsResponse<LineStringPropertiesV2>, ArrayBufferLike[]];
}

export function extractContent(properties: Array<NonNumericProps<LineStringPropertiesV2>>): ContentBufferArrays {
  const encoder = new TextEncoder();
  const texts = properties.map(d => encoder.encode(d.content).buffer);
  return {
    contentArray: texts
  };
}

export function randomColor(): [number, number, number, number] {
  const color = [];
  for (let i = 0; i < 3; i++) {
    color.push(Math.round(Math.random() * 255));
  }
  color.push(255);
  return color as [number, number, number, number];
}
function GetBufferFromBinaryAttribute(attribute: BinaryAttribute): { size: number, value: ArrayBufferLike } {
  return {
    size: attribute.size,
    value: attribute.value.buffer
  };
}
