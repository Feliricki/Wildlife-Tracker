/// <reference lib="webworker" />

// import { ArcLayer, GeoJsonLayer } from '@deck.gl/layers/typed';
import { BinaryLineStringResponse, BufferAttribute, ContentBufferArrays, NumericPropsResponse, WorkerFetchRequest } from "./MessageTypes";
import { LineStringFeature, LineStringFeatures, LineStringPropertiesV2 } from "./GeoJsonTypes";
// import { environment } from '../../environments/environment';
import { geojsonToBinary } from '@loaders.gl/gis'
import { BinaryLineFeatures, BinaryAttribute } from '@loaders.gl/schema'
// import { ISubscription, HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { NonNumericProps, NumericPropsType } from "./MessageTypes";
import * as signalR from '@microsoft/signalr';


let streamSubscription: signalR.ISubscription<LineStringFeature<LineStringPropertiesV2>> | null = null;

addEventListener('message', ({ data }) => {

  console.log(`Data type = ${data.type} in web worker.`);
  switch (data.type) {
    case "FetchRequest":
      setData(data.data as WorkerFetchRequest);
      break;

    default:
      console.log("Default case in web worker");
      break;
  }
});

// TODO: Find a way to keep track of chunk indices.
export async function setData(
  fetchRequest: WorkerFetchRequest,
  mainThread: boolean = false) {
  console.log(`Running setData in webworker. Main thread = ${mainThread}`);
  try {

    streamSubscription?.dispose();
    const connection: signalR.HubConnection =
      new signalR.HubConnectionBuilder()
        .configureLogging(signalR.LogLevel.Debug)
        .withUrl("https://localhost:4200/api/MoveBank-Hub", { withCredentials: false })
        .withStatefulReconnect()
        .build();

    await connection.start();

    console.log("SignalR connection made in web worker.");

    const streamResponse =
      connection.stream<LineStringFeatures<LineStringPropertiesV2>>("StreamEvents", fetchRequest.request);

    streamSubscription = streamResponse.subscribe({

      next: handleFeatures,
      complete: () => {
        console.log("Stream successfully ended.");
      },
      error: (err: unknown) => console.error(err)

    });

  } catch (error) {
    console.error(error);
  }
}

async function handleFeatures(featuresRes: LineStringFeatures<LineStringPropertiesV2>) {
  const features = featuresRes.features;
  const binaryFeature = geojsonToBinary(features);
  const binaryLineFeatures = binaryFeature.lines;

  console.log(`Processing ${featuresRes.count} features from the signalr client`);

  if (binaryLineFeatures === undefined || featuresRes.count === 0) return;

  const binaryResponse = createBinaryResponse(
    binaryLineFeatures,
    featuresRes);

  postMessage(binaryResponse[0], binaryResponse[1]);
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
    featureId: BinaryResponseHelper(binaryLines.featureIds),
    globalFeatureIds: BinaryResponseHelper(binaryLines.globalFeatureIds),
    pathIndices: BinaryResponseHelper(binaryLines.pathIndices),
    position: BinaryResponseHelper(binaryLines.positions),
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

function BinaryResponseHelper(attribute: BinaryAttribute): { size: number, value: ArrayBufferLike } {
  return {
    size: attribute.size,
    value: attribute.value.buffer
  };
}
