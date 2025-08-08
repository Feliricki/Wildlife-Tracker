import {
    ArcLayer,
    ArcLayerProps,
    LineLayer,
    LineLayerProps,
    ScatterplotLayer,
    ScatterplotLayerProps
} from '@deck.gl/layers';
import {
    GridLayer,
    HeatmapLayer,
    HexagonLayer,
    ScreenGridLayer,
    HexagonLayerProps,
    GridLayerProps
} from '@deck.gl/aggregation-layers';
import { Color, Layer } from '@deck.gl/core';
import { LayerTypes } from './DeckOverlayController';
import { BinaryLineFeature, DeckGlRenderingAttributes, BinaryPointFeature, AnimalMovementEvent } from './deckgl-types';
import { randomColor } from './deck-gl.worker';


export class LayerFactory {

    private static individualColors = new Map<string, [Color, Color]>();

    public static createLayer(
        layerType: LayerTypes,
        data: (BinaryLineFeature & DeckGlRenderingAttributes) | AnimalMovementEvent[],
        layerId: number,
    ): Layer | null {
        switch (layerType) {
            case LayerTypes.ArcLayer:
                return this.createArcLayer(data as BinaryLineFeature & DeckGlRenderingAttributes, layerId);
            case LayerTypes.ScatterplotLayer:
                return this.createScatterplotLayer(data as BinaryLineFeature & DeckGlRenderingAttributes, layerId);
            // case LayerTypes.HexagonLayer:
            //     return this.createHexagonLayer(data as BinaryPointFeature, layerId, aggregationOptions);
            case LayerTypes.LineLayer:
                return this.createLineLayer(data as BinaryLineFeature & DeckGlRenderingAttributes, layerId);
            case LayerTypes.ScreenGridLayer:
                return this.createScreenGridLayer(data as AnimalMovementEvent[], layerId);
            // case LayerTypes.GridLayer:
            //     return this.createGridLayer(data as AnimalMovementEvent[], layerId);
            // case LayerTypes.HeatmapLayer:
            //     return this.createHeatmapLayer(data as AnimalMovementEvent[], layerId);
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

    private static createHeatmapLayer(binaryFeatures: BinaryPointFeature, layerId: number): HeatmapLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        // BUG: The length is being set to binaryFeatures causing the lag probably
        const heatmapProps = {
            id: `${LayerTypes.HeatmapLayer}-${layerId}`,
            data: {
                length: binaryFeatures,
                attributes: {
                    getPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    },
                },
            },
            pickable: false,
            aggregation: "SUM" as const,
            radiusPixels: 30,
            intensity: 1,
            threshold: 0.3,
            getWeight: 1,
        };

        return new HeatmapLayer(heatmapProps);
    }

    // Temporarily disabled due to compilation issues and user request.
    private static createHexagonLayer(
        binaryFeatures: BinaryPointFeature,
        layerId: number,
        aggregationOptions?: Partial<HexagonLayerProps>
    ): HexagonLayer | null {
        // Temporarily disabled due to compilation issues and user request.
        return null;
    }

    private static createGridLayer(
        binaryFeatures: BinaryPointFeature,
        layerId: number,
        aggregationOptions?: Partial<GridLayerProps>
    ): GridLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const gridProps = {
            id: `${LayerTypes.GridLayer}-${layerId}`,
            data: {
                length: positions.value.byteLength / (positionSize * 4),
                attributes: {
                    getPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    }
                },
            },
            colorRange: aggregationOptions?.colorRange,
            gpuAggregation: aggregationOptions?.gpuAggregation !== undefined ? aggregationOptions.gpuAggregation : true,
            pickable: true,
        };
        return new GridLayer(gridProps);
    }

    private static createScreenGridLayer(movementData: AnimalMovementEvent[], layerId: number): ScreenGridLayer {
        // const BYTE_SIZE = 4;
        // const positions = movementData.positions;
        // const positionSize = positions.size;
        // const entrySize = positionSize * 2 * BYTE_SIZE;

        return new ScreenGridLayer<AnimalMovementEvent>({
            id: `${LayerTypes.ScreenGridLayer}-${layerId}`,
            data: movementData,
            // getPosition: d => d.15:31,
            // data: {
            //     length: binaryFeatures.length,
            //     attributes: {
            //         getPosition: {
            //             value: new Float32Array(positions.value),
            //             size: positionSize,
            //             stride: entrySize,
            //             offset: 0,
            //         }
            //     },
            // },
            pickable: true,
            cellSizePixels: 20,
            opacity: 0.8,
        });
    }

    private static createLineLayer(binaryFeatures: BinaryLineFeature & DeckGlRenderingAttributes, layerId: number): LineLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;
        const colors = this.getColorHelper(binaryFeatures.individualLocalIdentifier);

        const lineLayerProps: LineLayerProps = {
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
        };
        return new LineLayer(lineLayerProps);
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
