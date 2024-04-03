import { LayerTypes } from "./DeckOverlayController";


export class LayerTypesHelper {
  static readonly pathTypeLayers = new Set<LayerTypes>([
    LayerTypes.PathLayer, LayerTypes.ArcLayer,
    LayerTypes.LineLayer,
  ]);

  static readonly pointTypeLayers = new Set<LayerTypes>([
    LayerTypes.ScatterplotLayer,
    // NOTE:Could potentially include the geojson layer
    // if only points are supplied
  ]);

  static readonly aggregationLayers = new Set<LayerTypes>([
    LayerTypes.GridLayer, LayerTypes.ScreenGridLayer,
    LayerTypes.HeatmapLayer, LayerTypes.HexagonLayer,
  ]);

  public static isPathTypeLayer(layer: LayerTypes): boolean {
    return this.pathTypeLayers.has(layer)
  }

  public static isPointTypeLayer(layer: LayerTypes): boolean {
    return this.pointTypeLayers.has(layer);
  }

  public static isAggregationLayer(layer: LayerTypes): boolean {
    return this.aggregationLayers.has(layer);
  }

  public static layerToString(layer: LayerTypes): string {
    switch (layer) {
      case LayerTypes.ArcLayer:
        return "arc";
      case LayerTypes.LineLayer:
        return "line";
      case LayerTypes.TextLayer:
        return "text";
      case LayerTypes.TripsLayer:
        return "trip";
      case LayerTypes.GeoJsonLayer:
        return "geojson";
      case LayerTypes.ScreenGridLayer:
        return "screen grid";
      case LayerTypes.TileLayer:
        return "tile";
      case LayerTypes.GPUGridLayer:
        return "gpu grid";
      case LayerTypes.ScatterplotLayer:
        return "scatterplot";
      case LayerTypes.HeatmapLayer:
        return "heatmap";
      case LayerTypes.PathLayer:
        return "path";
      case LayerTypes.GridLayer:
        return "grid";
      case LayerTypes.HexagonLayer:
        return "hexagon";
      default:
        return "no supported"
    }
  }
}
