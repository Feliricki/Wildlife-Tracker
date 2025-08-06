import {
    ArcLayer,
    ArcLayerProps,
    LineLayer,
    LineLayerProps,
    PathLayer,
    PathLayerProps,
    ScatterplotLayer,
    ScatterplotLayerProps
} from '@deck.gl/layers/typed';
import {
    GridLayer,
    GridLayerProps,
    HeatmapLayer,
    HeatmapLayerProps,
    HexagonLayer,
    HexagonLayerProps,
    ScreenGridLayer,
    ScreenGridLayerProps
} from '@deck.gl/aggregation-layers/typed';
import { Color, Layer, LayerProps } from '@deck.gl/core/typed';
import { LayerTypes } from './DeckOverlayController';
import { BinaryLineFeatures } from '@loaders.gl/schema';
import { DeckGlRenderingAttributes } from './deckgl-types';
import { randomColor } from './deck-gl.worker';

type PointLayerProps = Partial<ScatterplotLayerProps>;
type PathLikeLayerProps = Partial<PathLayerProps & LineLayerProps & ArcLayerProps>;
type AggregationLayerProps = Partial<HexagonLayerProps & ScreenGridLayerProps & GridLayerProps>;

export class LayerFactory {

    private static individualColors = new Map<string, [Color, Color]>();

    public static createLayer(
        layerType: LayerTypes,
        data: BinaryLineFeatures & DeckGlRenderingAttributes,
        layerId: number
    ): Layer | null {
        switch (layerType) {
            case LayerTypes.ArcLayer:
                return this.createArcLayer(data, layerId);
            case LayerTypes.ScatterplotLayer:
                return this.createScatterplotLayer(data, layerId);
            case LayerTypes.HexagonLayer:
                return this.createHexagonLayer(data, layerId);
            case LayerTypes.LineLayer:
                return this.createLineLayer(data, layerId);
            case LayerTypes.ScreenGridLayer:
                return this.createScreenGridLayer(data, layerId);
            case LayerTypes.GridLayer:
                return this.createGridLayer(data, layerId);
            case LayerTypes.HeatmapLayer:
                return this.createHeatmapLayer(data, layerId);
            default:
                return null;
        }
    }

    private static createArcLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): ArcLayer {
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

    private static createScatterplotLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): ScatterplotLayer {
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

    private static createHeatmapLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): HeatmapLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const heatmapProps = {
            id: `${LayerTypes.HeatmapLayer}-${layerId}`,
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
            pickable: false,
            aggregation: "SUM" as const,
            radiusPixels: 30,
            intensity: 1,
            threshold: 0.3,
            getWeight: 1,
        };

        return new HeatmapLayer(heatmapProps);
    }

    private static createHexagonLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): HexagonLayer<Float32Array> {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const hexagonLayerProps = {
            id: `${LayerTypes.HexagonLayer}-${layerId}`,
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
            elevationRange: [0, 3000] as [number, number],
            radius: 1000,
            pickable: true,
            autoHighlight: true,
            extruded: true,
        };
        return new HexagonLayer(hexagonLayerProps);
    }

    private static createGridLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): GridLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const gridProps = {
            id: `${LayerTypes.GridLayer}-${layerId}`,
            data: {
                length: binaryFeatures.length,
                attributes: {
                    getPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    }
                },
            },
            pickable: true,
        };
        return new GridLayer(gridProps);
    }

    private static createScreenGridLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): ScreenGridLayer {
        const BYTE_SIZE = 4;
        const positions = binaryFeatures.positions;
        const positionSize = positions.size;
        const entrySize = positionSize * 2 * BYTE_SIZE;

        const screengridProps = {
            id: `${LayerTypes.ScreenGridLayer}-${layerId}`,
            data: {
                length: binaryFeatures.length,
                attributes: {
                    getPosition: {
                        value: new Float32Array(positions.value),
                        size: positionSize,
                        stride: entrySize,
                        offset: 0,
                    }
                },
            },
            pickable: true,
            cellSizePixels: 20,
            opacity: 0.8,
        };
        return new ScreenGridLayer(screengridProps);
    }

    private static createLineLayer(binaryFeatures: BinaryLineFeatures & DeckGlRenderingAttributes, layerId: number): LineLayer {
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
