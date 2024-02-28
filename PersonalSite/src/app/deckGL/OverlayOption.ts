import { LayerTypes } from "./GoogleOverlay";


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
}
