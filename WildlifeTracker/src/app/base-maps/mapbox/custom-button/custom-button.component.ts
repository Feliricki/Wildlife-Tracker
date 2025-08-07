import { Component, Input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import mapboxgl from "mapbox-gl";
import { setSourceLayers } from "../layer-controls";

type MapLayers = "standard" | "outdoors" | "satellite";

enum MapStyles {
  StandardLabel = "mapbox://styles/feliricki/cltqf12yx00p301p5dq5hcmiv",
  StandardNoLabel = "mapbox://styles/feliricki/cltt2y3nr00kb01pb678qbtwo",

  SatelliteLabel = "mapbox://styles/feliricki/cltqh2rpe031p01qee1x69a67",
  SatelliteNoLabel = "mapbox://styles/feliricki/cltt4rrni00up01qjhe4t8yob",

  OutdoorsLabel = "mapbox://styles/feliricki/cltqgt2be027701qpeui970ly",
  OutdoorsNoLabel = "mapbox://styles/feliricki/cltt51mik00uw01qjfpnfcm6s",
}


// TODO:This component needs a rename
// Needed functionality
// Given a layer, returns it's same layer version
// with and without 3d terrain enabled.
// with and without labels.
@Component({
    selector: "app-custom-button",
    styleUrl: './custom-button.scss',
    templateUrl: './custom-button.component.html',
    imports: [MatButtonModule, MatIconModule]
})
export class CustomButtonComponent {
  readonly standardLayers = [
    MapStyles.StandardLabel, MapStyles.StandardNoLabel
  ];

  readonly satelliteLayers = [
    MapStyles.SatelliteLabel, MapStyles.SatelliteNoLabel
  ];

  readonly outdoorsLayers = [
    MapStyles.OutdoorsLabel, MapStyles.OutdoorsNoLabel
  ];

  readonly labelledLayers = new Set<string>([
    MapStyles.StandardLabel, MapStyles.OutdoorsLabel, MapStyles.SatelliteLabel
  ]);

  // NOTE:This constant is unnecessary since the terrain does not require a full reload of the map.
  // readonly terrainLayers = new Set<string>([
  //   MapStyles.StandardLabelTerrain, MapStyles.StandardNoLabelTerrain,
  //   MapStyles.OutdoorsLabelTerrain, MapStyles.OutdoorsNoLabelTerrain,
  //   MapStyles.SatelliteLabelTerrain, MapStyles.SatelliteNoLabelTerrain,
  // ]);

  @Input() map?: mapboxgl.Map;
  @Input() collection?: GeoJSON.FeatureCollection<GeoJSON.Point>;
  @Input() studiesVisible: boolean = true;

  terrainEnabled: boolean = false;
  labelEnabled: boolean = true;

  currentLayerType: MapLayers = "standard";
  currentMapStyle: MapStyles = MapStyles.StandardLabel;

  initializedCallback: boolean = false;
  togglingLabels: boolean = false;

  constructor() {}

  initializeMapCallback(): void {
    if (this.initializedCallback || !this.map) return;

    if (!this.map.getSource('mapbox-dem')) {
      this.map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      });
    }

    this.map.on('style.load', () => {

      if (!this.map || !this.collection) {
        return;
      }
      if (!this.map.getSource('mapbox-dem')) {
        this.map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        });
      }

      // NOTE:This sets the current terrain depending on the current state of the map.
      this.map.setTerrain(this.terrainEnabled ? { source: 'mapbox-dem', exaggeration: 1 } : null);
      this.map.getStyle().layers.forEach(layer => {
        if (layer.type === "symbol" && layer.id !== 'cluster-count') {
          this.map?.setLayoutProperty(layer.id, "visibility", this.labelEnabled ? "visible" : "none");
        }
      });

      // NOTE:This sets the studies source and layers.
      setSourceLayers(this.map, this.collection, "studies", this.studiesVisible);
    });

    this.initializedCallback = true;
  }

  toggleTerrain(): void {
    if (!this.map) return;
    this.initializeMapCallback();
    this.terrainEnabled = !this.terrainEnabled;

    if (!this.map.getSource('mapbox-dem')) {
      this.map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      });
    }

    this.map.setTerrain(this.terrainEnabled ? { source: "mapbox-dem", exaggeration: 1 } : null);
  }

  toggleLabel(): void {
    if (!this.collection || !this.map) return;
    this.initializeMapCallback();

    this.labelEnabled = !this.labelEnabled;
    this.map.getStyle().layers.forEach(layer => {
      if (layer.type === 'symbol' && layer.id !== 'cluster-count') {
        this.map?.setLayoutProperty(layer.id, "visibility", this.labelEnabled ? "visible" : "none");
      }
    });
  }

  selectLayer(layer: MapLayers) {
    if (!this.collection || !this.map) return;
    this.initializeMapCallback();
    let collection: MapStyles[] = [];
    switch (layer) {
      case "standard":
        collection = this.standardLayers;
        break;
      case "outdoors":
        collection = this.outdoorsLayers;
        break;
      case "satellite":
        collection = this.satelliteLayers;
        break;
    }

    // INFO:This line is redundant as the terrain and labels are set every time the style changes.
    const newStyle = collection.filter(elem => this.labelledLayers.has(elem) === this.labelEnabled).at(0);
    if (newStyle !== undefined) {
      this.currentMapStyle = newStyle;
      this.currentLayerType = layer;
      this.map.setStyle(this.currentMapStyle);
    }
  }
}

