/// <reference lib="webworker" />

import {
    BinaryAnimalMovementLineResponse,
    BinaryDataBuffer,
    TooltipContentBuffers,
    NumericPropsResponse,
    MovementDataFetchRequest,
    AnimalMovementLineFeature,
    AnimalMovementLineCollection,
    AnimalMovementLineBundle,
    AnimalMovementEvent,
    NonNumericProps,
    NumericPropsType,
    BinaryAttribute
} from "./deckgl-types";
import { geojsonToBinary } from '@loaders.gl/gis'
import * as signalR from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import * as msgPack from '@msgpack/msgpack';
import { isDevMode } from "@angular/core";
import { TypedArray } from '@loaders.gl/schema/dist/lib/table/arrow-api';
import { BinaryLineFeature } from "@loaders.gl/schema";


let streamSubscription: signalR.ISubscription<AnimalMovementLineFeature<AnimalMovementEvent>> | null = null;
let hubConnection: signalR.HubConnection | null = null;

addEventListener('message', ({ data }) => {

    switch (data.type) {
        case "FetchRequest":
            setData(data.data as MovementDataFetchRequest);
            break;

        case "Cleanup":
            cleanup();
            break;

        default:
            break;
    }
});

async function cleanup() {
    if (streamSubscription) {
        streamSubscription.dispose();
        streamSubscription = null;
    }

    if (hubConnection) {
        try {
            await hubConnection.stop();
        } catch (error) {
            console.warn("Error during cleanup:", error);
        }
        hubConnection = null;
    }
}


export async function setData(
    fetchRequest: MovementDataFetchRequest
) {
    try {
        // Properly dispose of previous connection and subscription
        if (streamSubscription) {
            streamSubscription.dispose();
            streamSubscription = null;
        }

        if (hubConnection && hubConnection.state !== signalR.HubConnectionState.Disconnected) {
            try {
                await hubConnection.stop();
            } catch (error) {
                console.warn("Error stopping previous connection:", error);
            }
        }
        hubConnection = null;

        // Brief delay to ensure server-side cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        const url = isDevMode() ? "https://localhost:4200/api/MoveBank-Hub"
            : "https://api.wildlife-tracker.com/api/MoveBank-Hub";

        hubConnection = new signalR.HubConnectionBuilder()
            .configureLogging(signalR.LogLevel.Debug)
            .withUrl(url, { withCredentials: false })
            .withHubProtocol(new MessagePackHubProtocol())
            .withStatefulReconnect()
            .build();

        await hubConnection.start();

        // Verify connection state before attempting to stream
        if (hubConnection.state !== signalR.HubConnectionState.Connected) {
            throw new Error(`Connection not ready for streaming. Current state: ${hubConnection.state}`);
        }

        const streamResponse = hubConnection.stream<TypedArray>("StreamEvents", fetchRequest.request);

        streamSubscription = streamResponse.subscribe({
            next: response => {
                // this operation should only be performed once.
                const decoded = msgPack.decode(response) as Array<number | string | unknown[]>;
                const featuresRes: AnimalMovementLineBundle<AnimalMovementEvent> = parseMsgPackResponse(decoded);

                handleFeatures(featuresRes, "BinaryLineString").then(res => {
                    if (res !== null) {
                        postMessage(res[0], res[1]);
                    }
                });
            },
            complete: () => {
                console.log("Stream completed successfully");
                postMessage({
                    type: "StreamEnded"
                });

            },
            error: (err: unknown) => {
                console.error("Stream error:", err);

                // Clean up on stream error
                if (streamSubscription) {
                    streamSubscription.dispose();
                    streamSubscription = null;
                }

                postMessage({
                    type: "StreamError"
                });
            }
        });

    } catch (error) {
        console.error("Connection setup error:", error);

        // Clean up on error
        if (streamSubscription) {
            streamSubscription.dispose();
            streamSubscription = null;
        }

        if (hubConnection) {
            try {
                await hubConnection.stop();
            } catch (stopError) {
                console.warn("Error stopping connection after setup failure:", stopError);
            }
            hubConnection = null;
        }

        postMessage({
            type: "StreamError"
        });
    }
}

export async function handleFeatures(
    featuresRes: AnimalMovementLineBundle<AnimalMovementEvent>,
    responseType: "BinaryLineString" | "AggregatedEvents"
):
    Promise<[BinaryAnimalMovementLineResponse<AnimalMovementEvent>, ArrayBufferLike[]] | null> {

    if (featuresRes.count === 0) return null;

    const features = featuresRes.features;

    const binaryFeature = geojsonToBinary(features);
    const binaryLineFeatures: BinaryLineFeature | undefined = binaryFeature.lines;

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
    } as AnimalMovementLineBundle<AnimalMovementEvent>;
}

function parseMsgPackFeature(feature: Array<object>): AnimalMovementLineFeature<AnimalMovementEvent> {
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
    } as AnimalMovementLineFeature<AnimalMovementEvent>;
}


export function createBinaryResponse(
    binaryLines: BinaryLineFeature,
    featureRes: AnimalMovementLineBundle<AnimalMovementEvent>,
    responseType: "BinaryLineString" | "AggregatedEvents"):
    [BinaryAnimalMovementLineResponse<AnimalMovementEvent>, ArrayBufferLike[]] {

    const properties = binaryLines.properties as NonNumericProps<AnimalMovementEvent>[];
    const content = extractContent(properties);

    const numericPropsPairValue = extractNumericProps(binaryLines.numericProps);
    const response: BinaryAnimalMovementLineResponse<AnimalMovementEvent> = {
        type: responseType,
        index: featureRes.index ?? 0,
        length: featureRes.count ?? 0,
        individualLocalIdentifier: featureRes.individualLocalIdentifier ?? "unknown",
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
export function generateColors(numFeatures: number): BinaryDataBuffer {
    const colors: number[] = [];
    for (let i = 0; i < numFeatures; i++) {
        colors.push(...randomColor());
        colors.push(...randomColor());
    }

    return { size: 4, value: new Uint8Array(colors).buffer };
}

export function extractNumericProps(
    numericProps: { [key: string]: BinaryAttribute }) {

    const castedProps = numericProps as NumericPropsType<AnimalMovementEvent>;

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
            size: castedProps.distanceKm?.size ?? 2,
            value: castedProps.distanceKm.value.buffer
        },
        distanceTravelledKm: {
            size: castedProps.distanceTravelledKm.size,
            value: castedProps.distanceTravelledKm.value.buffer
        },
    } as NumericPropsResponse<AnimalMovementEvent>;

    return [newObj, buffers] as [NumericPropsResponse<AnimalMovementEvent>, ArrayBufferLike[]];
}

export function extractContent(properties: Array<NonNumericProps<AnimalMovementEvent>>): TooltipContentBuffers {
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

export function emptyLineStringFeatureCollection(count: number): AnimalMovementLineBundle<AnimalMovementEvent> {
    return {
        features: [],
        individualLocalIdentifier: "all",
        index: 0,
        count: count
    };
}

export function emptyFeatureCollection(): AnimalMovementLineCollection<AnimalMovementEvent> {
    return {
        type: "FeatureCollection",
        features: []
    };
}
