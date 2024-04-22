/// <reference lib="webworker" />

import { BinaryLineStringResponse, BufferAttribute, ContentBufferArrays, NumericPropsResponse, WorkerFetchRequest } from "./MessageTypes";
import { LineStringFeature, LineStringFeatureCollection, LineStringFeatures, LineStringPropertiesV2 } from "./GeoJsonTypes";
// import { environment } from '../../environments/environment';
import { geojsonToBinary } from '@loaders.gl/gis'
import { BinaryLineFeatures, BinaryAttribute, TypedArray } from '@loaders.gl/schema'
import { NonNumericProps, NumericPropsType } from "./MessageTypes";
import * as signalR from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import * as msgPack from '@msgpack/msgpack';
import { isDevMode } from "@angular/core";


let streamSubscription: signalR.ISubscription<LineStringFeature<LineStringPropertiesV2>> | null = null;
// let allEvents: LineStringFeatures<LineStringPropertiesV2> = emptyLineStringFeatureCollection(0);

addEventListener('message', ({ data }) => {

  switch (data.type) {
    case "FetchRequest":
      setData(data.data as WorkerFetchRequest);
      break;

    default:
      break;
  }
});



// TODO:Use the fetch api in browser that do not support webworkers.
// Work on getting aggregation layers working by saving the results in a singular data structure
// consider offloading the work to another web worker.
export async function setData(
  fetchRequest: WorkerFetchRequest
) {
  try {
    streamSubscription?.dispose();

    const url = isDevMode() ? "https://localhost:4200/api/MoveBank-Hub"
      : "https://api.wildlife-tracker.com/api/MoveBank-Hub";

    const connection: signalR.HubConnection =
      new signalR.HubConnectionBuilder()
        .configureLogging(signalR.LogLevel.Debug)
        .withUrl(url, { withCredentials: false })
        .withHubProtocol(new MessagePackHubProtocol())
        .withStatefulReconnect()
        .build();

    await connection.start();

    const streamResponse =
      connection.stream<TypedArray>("StreamEvents", fetchRequest.request);

    streamSubscription = streamResponse.subscribe({
      next: response => {
        // NOTE:this operation should only be performed once.
        const decoded = msgPack.decode(response) as Array<number | string | unknown[]>;
        const featuresRes: LineStringFeatures<LineStringPropertiesV2> = parseMsgPackResponse(decoded);

        handleFeatures(featuresRes, "BinaryLineString").then(res => {
          if (res !== null) {
            // TODO:Remove once all of the typedArray types have been written down.
            // console.log(res);
            postMessage(res[0], res[1]);
          }
        });

        // TODO: Test the performance of this algorithm, if it is too slow
        // then look up how to spawn a web worker here.
        // allEvents.features.push(...featuresRes.features);
        // allEvents.count = featuresRes.features.length;
        // handleEventAggregation(allEvents).then(res => {
        //   if (res !== null) {
        //     postMessage(res[0], res[1]);
        //   }
        // });
      },
      complete: () => {
        // TODO:Consider writing another type to hold the information for the aggregated events.
        console.log("Stream successfully ended.");
        // allEvents = emptyLineStringFeatureCollection(0);
        postMessage({
          type: "StreamEnded"
        });

      },
      error: (err: unknown) => {
        console.error(err);
        // allEvents = emptyLineStringFeatureCollection(0);
        postMessage({
          type: "StreamError"
        });
      }
    });

  } catch (error) {
    console.error(error);
  }
}

export async function handleFeatures(
  featuresRes: LineStringFeatures<LineStringPropertiesV2>,
  responseType: "BinaryLineString" | "AggregatedEvents"
):
  Promise<[BinaryLineStringResponse<LineStringPropertiesV2>, ArrayBufferLike[]] | null> {

  if (featuresRes.count === 0) return null;

  const features = featuresRes.features;

  const binaryFeature = geojsonToBinary(features);
  const binaryLineFeatures: BinaryLineFeatures | undefined = binaryFeature.lines;

  if (binaryLineFeatures === undefined || features.length === 0) return null;

  const binaryResponse = createBinaryResponse(
    binaryLineFeatures,
    featuresRes,
    responseType);

  return binaryResponse;
}



function parseMsgPackResponse(msg: Array<number | string | unknown[]>) {
  const features = msg[0] as object[][];
  const localIdentifier = msg[1] as string;
  const count = msg[2] as number;
  const index = msg[3] as number;

  const parsedFeatures = features.map(parseMsgPackFeature);
  return {
    features: parsedFeatures,
    individualLocalIdentifier: localIdentifier,
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
  featureRes: LineStringFeatures<LineStringPropertiesV2>,
  responseType: "BinaryLineString" | "AggregatedEvents"):
  [BinaryLineStringResponse<LineStringPropertiesV2>, ArrayBufferLike[]] {

  const properties = binaryLines.properties as NonNumericProps<LineStringPropertiesV2>[];
  const content = extractContent(properties);

  // NOTE: The following returns the object being returns and an array of all the buffers within it.
  const numericPropsPairValue = extractNumericProps(binaryLines.numericProps);
  const response: BinaryLineStringResponse<LineStringPropertiesV2> = {
    type: responseType,
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

  // console.log(castedProps);
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
      size: castedProps.distanceKm?.size ?? 2,
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
  const color: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) {
    color[i] = Math.round(Math.random() * 255);
  }
  color[3] = 255;
  return color;
}

function GetBufferFromBinaryAttribute(attribute: BinaryAttribute): { size: number, value: ArrayBufferLike } {
  return {
    size: attribute.size,
    value: attribute.value.buffer
  };
}

export function emptyLineStringFeatureCollection(count: number): LineStringFeatures<LineStringPropertiesV2> {
  return {
    features: [],
    individualLocalIdentifier: "all",
    index: 0,
    count: count
  };
}

export function emptyFeatureCollection(): LineStringFeatureCollection<LineStringPropertiesV2> {
  return {
    type: "FeatureCollection",
    features: []
  };
}
