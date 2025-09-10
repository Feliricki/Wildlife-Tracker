import {
    ArcLayer,
    ArcLayerProps,
    LineLayer,
    ScatterplotLayer,
    ScatterplotLayerProps
} from '@deck.gl/layers';
import {
    GridLayer,
    HeatmapLayer,
    HexagonLayer,
    ScreenGridLayer,
} from '@deck.gl/aggregation-layers';
import { Color, Layer } from '@deck.gl/core';
import { LayerTypes } from './DeckOverlayController';
import { BinaryLineFeature, DeckGlRenderingAttributes, AnimalPointEvent } from './deckgl-types';
import { randomColor } from './deck-gl.worker';


export class LayerFactory {

    private static individualColors = new Map<string, [Color, Color]>();

    // TODO:Finish this method
    public static createAggregationLayer(
        layerType: LayerTypes,
        data: AnimalPointEvent[],
        updateRange?: { startRow: number, endRow: number }
    ): Layer | null {
        switch (layerType) {
            case LayerTypes.HeatmapLayer:
                return this.createHeatmapLayer(data, 0, updateRange);
            case LayerTypes.HexagonLayer:
                return this.createHexagonLayer(data, 0, updateRange);
            case LayerTypes.ScreenGridLayer:
                return this.createScreenGridLayer(data, 0, updateRange);
            case LayerTypes.GridLayer:
                return this.createGridLayer(data, 0);
            default:
                return null;
        }
    }

    public static createMultiLayer(
        layerType: LayerTypes,
        data: (BinaryLineFeature & DeckGlRenderingAttributes),
        layerId: number,
    ): Layer | null {
        switch (layerType) {
            case LayerTypes.ArcLayer:
                return this.createArcLayer(data, layerId);
            case LayerTypes.ScatterplotLayer:
                return this.createScatterplotLayer(data, layerId);
            case LayerTypes.LineLayer:
                return this.createLineLayer(data, layerId);
            default:
                return null;
        }
    }

    private static createArcLayer(binaryFeatures: BinaryLineFeature & DeckGlRenderingAttributes, layerId: number): ArcLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;
        const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

        const arcLayerProps: ArcLayerProps = {
            id: `${LayerTypes.ArcLayer}-${layerId}`,
            data: {
                length: binaryFeatures.length,
                attributes: {
                    getSourcePosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    },
                    getTargetPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: entrySize / 2,
                    },
                },
            },
            getSourceColor: colors[0],
            getTargetColor: colors[1],
            autoHighlight: true,
            colorFormat: "RGBA",
            pickable: true,
        };

        return new ArcLayer(arcLayerProps);
    }

    private static createScatterplotLayer(binaryFeatures: BinaryLineFeature & DeckGlRenderingAttributes, layerId: number): ScatterplotLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const scatterplotProps: ScatterplotLayerProps = {
            id: `${LayerTypes.ScatterplotLayer}-${layerId}`,
            data: {
                length: binaryFeatures.length,
                attributes: {
                    getPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    },
                },
            },
            radiusScale: 30,
            getRadius: 4,
            opacity: 0.8,
            radiusMinPixels: 1.0,
            getFillColor: [255, 0, 30],
            autoHighlight: true,
            pickable: true,
        };
        return new ScatterplotLayer(scatterplotProps);
    }

    private static createHeatmapLayer(
        data: AnimalPointEvent[],
        layerId: number,
        updateRange?: { startRow: number, endRow: number }
    ): HeatmapLayer {
        return new HeatmapLayer<AnimalPointEvent>({
            id: `${LayerTypes.HeatmapLayer}-${layerId}`,
            data: data,
            getPosition: point => point.location,
            pickable: false,
            aggregation: "SUM" as const,
            radiusPixels: 30,
            intensity: 1,
            threshold: 0.3,
            getWeight: 1,
            _dataDiff: updateRange === undefined ? undefined : () => [updateRange]
        });
    }

    // Temporarily disabled due to compilation issues
    private static createHexagonLayer(
        data: AnimalPointEvent[],
        layerId: number,
        updateRange?: { startRow: number, endRow: number }
    ): HexagonLayer {
        return new HexagonLayer<AnimalPointEvent>({
            id: `${LayerTypes.HexagonLayer}-${layerId}`,
            data: data,
            getPosition: point => point.location,
            _dataDiff: updateRange === undefined ? undefined : () => [updateRange]
        });
    }

    // TODO:Look up the documentation on getting this up and running
    private static createGridLayer(
        data: AnimalPointEvent[],
        layerId: number,
    ): GridLayer {

        return new GridLayer<AnimalPointEvent>({
            id: `${LayerTypes.GridLayer}-${layerId}`,
            data: data,
            getPosition: point => point.location,
            // colorRange: aggregationOptions?.colorRange,
            // gpuAggregation: aggregationOptions?.gpuAggregation !== undefined ? aggregationOptions.gpuAggregation : true,
            pickable: true,
        });
    }

    private static createScreenGridLayer(
        data: AnimalPointEvent[],
        layerId: number,
        updateRange?: { startRow: number, endRow: number }): ScreenGridLayer {
        return new ScreenGridLayer<AnimalPointEvent>({
            id: `${LayerTypes.ScreenGridLayer}-${layerId}`,
            data: data,
            getPosition: point => point.location,
            pickable: true,
            cellSizePixels: 20,
            opacity: 0.8,
            _dataDiff: updateRange === undefined ? undefined :
                () => [updateRange]
        });
    }

    private static createLineLayer(binaryFeatures: BinaryLineFeature & DeckGlRenderingAttributes, layerId: number): LineLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;
        const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

        return new LineLayer({
            id: `${LayerTypes.LineLayer}-${layerId}`,
            data: {
                length: binaryFeatures.length,
                attributes: {
                    getSourcePosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0
                    },
                    getTargetPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: entrySize / 2
                    },
                },
            },
            colorFormat: "RGBA",
            pickable: true,
            getColor: colors[0],
            autoHighlight: true,
        });
    }

    private static getColorHelper(animal: string): [Color, Color] {
        const color = this.individualColors.get(animal);
        if (color !== undefined) {
            return color;
        }
        const newColor = [randomColor(), randomColor()] as [Color, Color];
        this.individualColors.set(animal, newColor);
        return newColor;
    }

    public static clearColors(): void {
        this.individualColors.clear();
    }
}
