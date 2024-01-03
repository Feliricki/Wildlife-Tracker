/// <reference lib="webworker" />

import { ArcLayer } from '@deck.gl/layers/typed';
import { LineStringFeatureCollection, WorkerFetchRequest } from "./GoogleOverlay";
// import { GoogleMapsOverlay } from '@deck.gl/google-maps/typed';

addEventListener('message', ({ data }) => {
  console.log(data);
  // let message: unknown = null;

  switch (data.type) {
    case "FetchRequest":
      setData(data as WorkerFetchRequest);
      break;
  }

  postMessage("messageResponse");
});

export async function setData(fetchRequest: WorkerFetchRequest) {
  try {

    console.log("Fetching data in setData");

    const overlay = fetchRequest.overlay;
    const response = await fetch(fetchRequest.request);
    const collections = await response.json() as LineStringFeatureCollection[];

    let i = 0;
    const layers = [] as ArcLayer[];
    for (const collection of collections){
      const newLayer = createArcLayer(collection, `arclayer-${i}`);
      layers.push(newLayer);
      i++;
    }

    overlay.setProps({
      layers: layers
    });

  } catch (error) {
    console.error(error);
  }
}

export function createArcLayer(
  lineStringFeatureCollection: LineStringFeatureCollection,
  layerId: string) {
  const arcLayer = new ArcLayer({
    id: layerId,
    data: lineStringFeatureCollection.features,
    pickable: true,
    getSourcePosition: feature => feature.geometry.coordinates[0],
    getTargetPosition: feature => feature.geometry.coordinates[1],
    getWidth: 5,
    getSourceColor: feature => feature.properties.sourceColor,
    getTargetColor: feature => feature.properties.targetColor,
  })
  return arcLayer;
  }
