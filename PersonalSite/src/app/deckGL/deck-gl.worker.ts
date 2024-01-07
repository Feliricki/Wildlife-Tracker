/// <reference lib="webworker" />

// import { ArcLayer, GeoJsonLayer } from '@deck.gl/layers/typed';
import { BinaryLineStringResponse, ContentInfo, WorkerFetchRequest } from "./MessageTypes";
import { LineStringFeatureCollection, LineStringProperties } from "./GeoJsonTypes";
import { environment } from '../../environments/environment';
import { geojsonToBinary } from '@loaders.gl/gis'
import { BinaryLineFeatures, BinaryAttribute } from '@loaders.gl/schema'

// type NumericProps = {
//   timestamp: long;
// }
// type NumericProps<T> = {
//   [Property in keyof T]: T[Property] extends number ? T[Property] : never;
// }

type NonNumericProps<T> = {
  [Property in keyof T]: T[Property] extends number ? never : T[Property];
}


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

// TODO: Test this function and then switch to using a grpc client.
export async function setData(fetchRequest: WorkerFetchRequest, mainThread: boolean = false) {
  try {

    const url = environment.baseUrl + "api/MoveBank/GetEventData";
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(fetchRequest.request),
      headers: {
        'Accept': 'application/json, text/plain',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      mode: "cors"
    });

    console.log(mainThread);

    const jsonString = await response.json();
    const collections: LineStringFeatureCollection[] = JSON.parse(jsonString);

    let i = 0;
    for (const collection of collections) {
      const binaryFeatures = geojsonToBinary(collection.features);
      const binaryLines = binaryFeatures.lines;

      if (binaryLines === undefined) {
        i++;
        continue;
      }

      const binaryResponse = createBinaryResponse(binaryLines, i);
      postMessage(binaryResponse[0], binaryResponse[1]);
      i++;
    }

  } catch (error) {
    // TODO: Catch different types of errors.
    console.error(error);
  }
}

export function createBinaryResponse(binaryLines: BinaryLineFeatures, index: number):
  [BinaryLineStringResponse, ArrayBufferLike[]] {

  const properties = binaryLines.properties as unknown as NonNumericProps<LineStringProperties>[];
  const contentRes = extractContent(properties);
  const response: BinaryLineStringResponse = {
    type: "BinaryLineString",
    index: index,
    length: contentRes.contentArray.length,
    featureId: BinaryResponseHelper(binaryLines.featureIds),
    globalFeatureIds: BinaryResponseHelper(binaryLines.globalFeatureIds),
    pathIndices: BinaryResponseHelper(binaryLines.pathIndices),
    position: BinaryResponseHelper(binaryLines.positions),
    content: contentRes,
  };

  const buffers = [
    response.featureId.value,
    response.globalFeatureIds.value,
    response.pathIndices.value,
    response.position.value,
    ...contentRes.contentArray
  ]

  return [response, buffers];
}

export function extractContent(properties: Array<NonNumericProps<LineStringProperties>>): ContentInfo {
  const encoder = new TextEncoder();
  const texts = properties.map(d => encoder.encode(d.content).buffer);
  return {
    contentArray: texts
  };
}

export function randomColor(): [number, number, number, number] {
  const color = [];
  for (let i = 0; i < 3; i++) {
    color.push(Math.floor(Math.random() * 255));
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
