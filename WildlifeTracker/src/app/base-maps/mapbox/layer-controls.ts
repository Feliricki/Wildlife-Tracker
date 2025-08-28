import { NgElement, WithProperties } from "@angular/elements";
import mapboxgl, { GeoJSONSource, IControl } from "mapbox-gl";
import { CustomButtonComponent } from "./custom-button/custom-button.component";

// NOTE:This class works in tandem with the custom button class.
export class LayerControl implements IControl {
  _container?: NgElement & WithProperties<CustomButtonComponent>;
  _map?: mapboxgl.Map;

  constructor(
    public collection: GeoJSON.FeatureCollection<GeoJSON.Point>
  ) {
  }

  onAdd(map: mapboxgl.Map): HTMLElement {
    const container = document.createElement('custom-button-el') as NgElement & WithProperties<CustomButtonComponent>;
    container.map = map;
    container.collection = this.collection;

    this._container = container;
    this._map = map;

    return this._container;
  }

  onRemove(): void {
    if (!this._container) return;

    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }

  setStudiesVisibility(visibility: boolean): void {
    if (this._container) {
      this._container.studiesVisible = visibility;
    }
  }
}

export function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: []
  };
}

// ISSUE:The visibility of the symbol layer will sometimes be false.
export function setSourceLayers(
  map: mapboxgl.Map,
  collection: GeoJSON.FeatureCollection,
  source: string = "studies",
  setSourceData: boolean = true): void {

  const prevSource = map.getSource(source) as GeoJSONSource;
  if (prevSource) {
    prevSource.setData(setSourceData ? collection : emptyFeatureCollection());
    return;
  }

  map.addSource(source, {
    type: "geojson",
    data: setSourceData ? collection : emptyFeatureCollection(),
    cluster: true,
    clusterMinPoints: 2, // Default is 2
    clusterMaxZoom: 10,
    clusterRadius: 50,
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: source,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#fdda24', // Plasma (toned-down): Golden Amber for low density
        50,
        '#cd4a7e', // Plasma: Vivid magenta/red for medium density
        100,
        '#7201a8'  // Plasma: Deep purple for high density
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,
        50,
        30,
        100,
        40
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2,
        0
      ],
      'circle-stroke-color': '#ffffff'
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: source,
    filter: ['has', "point_count"],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
    paint: {
      'text-color': [
        'step',
        ['get', 'point_count'],
        '#000000', // Black text for yellow clusters
        50,
        '#ffffff', // White text for magenta and purple clusters
        100,
        '#ffffff'
      ]
    }
  });

  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: source,
    filter: ["!", ["has", "point_count"]],
    paint: {
      'circle-color': '#7A0403', // Plasma: Deep, dark red for individual markers
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff' // white outline
    },
  });
}
