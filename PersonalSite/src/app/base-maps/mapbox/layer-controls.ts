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
    console.log("Adding custom controls to mapbox overlay.");

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

  // toggleStudiesVisibility(): void {
  //   this._container?.toggleStudiesVisibility();
  // }

  setStudiesVisibility(visibility: boolean): void {
    if (this._container) {
      console.log(`Setting studies visibility to ${visibility}`);
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
    console.log(`PrevSource was set and setSourceData = ${setSourceData}`);
    prevSource.setData(setSourceData ? collection : emptyFeatureCollection());
    // map.getStyle().layers.forEach(layer => {
    //   if (layer.id === 'cluster-count'){
    //     map.setLayoutProperty(layer.id, "visibility", setSourceData ? "visible" : "none");
    //   }
    // });
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
      // Use step expressions (https://docs.mapbox.com/style-spec/reference/expressions/#step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 50
      //   * Yellow, 30px circles when point count is between 50 and 100
      //   * Pink, 40px circles when point count is greater than or equal to 100
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        50,
        '#f1f075',
        100,
        '#f28cb1'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,
        50,
        30,
        100,
        40
      ]
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
    }
  });

  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: source,
    filter: ["!", ["has", "point_count"]],
    paint: {
      'circle-color': '#11b4da',
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff' // white outline
    },
  });
}
