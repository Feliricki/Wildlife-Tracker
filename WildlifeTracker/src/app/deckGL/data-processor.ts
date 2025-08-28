import { BinaryAnimalMovementLineResponse, AnimalMovementEvent, DeckGlRenderingAttributes, BinaryDataBuffer, BinaryAttributeMap, BinaryLineFeature, BinaryAttribute, BinaryPointFeature, BinaryPolygonFeature, AnimalPointEvent } from "./deckgl-types";

export class DataProcessor {

  // Formally used to merged cumulative data for aggregation layers
  public static mergeBinaryResponse(
    prev: BinaryAnimalMovementLineResponse<object>,
    cur: BinaryAnimalMovementLineResponse<AnimalMovementEvent>
  ): BinaryAnimalMovementLineResponse<AnimalMovementEvent> {
    if (prev.length === 0) {
      return cur;
    }

    // Merge positions
    const prevPositions = new Float32Array(prev.position.value);
    const curPositions = new Float32Array(cur.position.value);
    const mergedPositions = {
      size: cur.position.size,
      value: new Float32Array(prevPositions.length + curPositions.length)
    };
    mergedPositions.value.set(prevPositions);
    mergedPositions.value.set(curPositions, prevPositions.length);

    // Merge path indices
    const prevPathIndices = new Uint16Array(prev.pathIndices.value);
    const curPathIndices = new Uint16Array(cur.pathIndices.value);
    const mergedPathIndices = {
      size: cur.pathIndices.size,
      value: new Uint16Array(prevPathIndices.length + curPathIndices.length),
    };
    mergedPathIndices.value.set(prevPathIndices);
    mergedPathIndices.value.set(curPathIndices, prevPathIndices.length);

    // Merge feature IDs
    const prevFeatureIds = new Uint16Array(prev.featureId.value);
    const curFeatureIds = new Uint16Array(cur.featureId.value);
    const mergedFeatureIds = {
      size: cur.featureId.size,
      value: new Uint16Array(prevFeatureIds.length + curFeatureIds.length)
    };
    mergedFeatureIds.value.set(prevFeatureIds);
    mergedFeatureIds.value.set(curFeatureIds, prevFeatureIds.length);

    // Merge global feature IDs
    const prevGlobalFeatureIds = new Uint16Array(prev.globalFeatureIds.value);
    const curGlobalFeatureIds = new Uint16Array(cur.globalFeatureIds.value);
    const mergedGlobalFeatureIds = {
      size: cur.globalFeatureIds.size,
      value: new Uint16Array(prevGlobalFeatureIds.length + curGlobalFeatureIds.length)
    };
    mergedGlobalFeatureIds.value.set(prevGlobalFeatureIds);
    mergedGlobalFeatureIds.value.set(curGlobalFeatureIds, prevGlobalFeatureIds.length);

    // Merge colors
    const prevColors = new Uint8Array(prev.colors.value);
    const curColors = new Uint8Array(cur.colors.value);
    const mergedColors = {
      size: cur.colors.size,
      value: new Uint8Array(prevColors.length + curColors.length)
    };
    mergedColors.value.set(prevColors);
    mergedColors.value.set(curColors, prevColors.length);

    // Merge content arrays
    const mergedContent = {
      contentArray: [...prev.content.contentArray, ...cur.content.contentArray]
    };

    // Merge numeric properties
    const mergedNumericProps = this.mergeNumericProps(
      prev.numericProps as { [key: string]: BinaryDataBuffer },
      cur.numericProps
    );

    return {
      type: "AggregatedEvents",
      featureId: mergedFeatureIds,
      globalFeatureIds: mergedGlobalFeatureIds,
      position: mergedPositions,
      index: 0,
      pathIndices: mergedPathIndices,
      length: prev.length + cur.length,
      content: mergedContent,
      colors: mergedColors,
      individualLocalIdentifier: "N/A",
      numericProps: mergedNumericProps as BinaryAttributeMap<AnimalMovementEvent>,
    };
  }



  // Helper function to convert a BinaryType into a AnimalPointEvent
  private static binaryToObject(data: BinaryAnimalMovementLineResponse<AnimalMovementEvent>): AnimalPointEvent[] {
    const events: AnimalPointEvent[] = [];
    const numFeatures = data.length;

    const positions = new Float32Array(data.position.value);
    const timestamps = new Float64Array(data.numericProps.sourceTimestamp.value);

    for (let i = 0; i < numFeatures; i += 1) {
      const position: [number, number] = [positions[i*4], positions[i*4+1]];
      const timestamp = timestamps[i*2];
      events.push({
        location: position,
        timestamp: timestamp
      });
    }

    return events;
  }

  // New method that uses object instead of typed arrays
  public static aggregatePoints(
    prev: AnimalPointEvent[],
    cur: BinaryAnimalMovementLineResponse<AnimalMovementEvent>
  ): AnimalPointEvent[] {
    prev.push(...this.binaryToObject(cur));
    return prev;
  }

  public static processBinaryData(binaryData: BinaryAnimalMovementLineResponse<AnimalMovementEvent>): BinaryLineFeature & DeckGlRenderingAttributes {
    // Validate input data
    if (!binaryData || binaryData.length === 0) {
      throw new Error('Invalid or empty binary data provided to processBinaryData');
    }

    try {
      const binaryLineFeatures: BinaryLineFeature & DeckGlRenderingAttributes = {
        type: "LineString",
        featureIds: {
          size: binaryData.featureId?.size || 1,
          value: new Uint16Array(binaryData.featureId?.value || [])
        },
        globalFeatureIds: {
          size: binaryData.globalFeatureIds?.size || 1,
          value: new Uint16Array(binaryData.globalFeatureIds?.value || [])
        },
        positions: {
          size: binaryData.position?.size || 3,
          value: new Float32Array(binaryData.position?.value || [])
        },
        pathIndices: {
          size: binaryData.pathIndices?.size || 1,
          value: new Uint16Array(binaryData.pathIndices?.value || [])
        },
        length: binaryData.length,
        content: binaryData.content || { contentArray: [] },
        colors: {
          size: binaryData.colors?.size || 3,
          value: new Uint8Array(binaryData.colors?.value || [])
        },
        individualLocalIdentifier: binaryData.individualLocalIdentifier || "unknown",
        numericProps: this.numericPropsHelper(binaryData.numericProps),
        properties: [],
      };
      return binaryLineFeatures;
    } catch (error) {
      console.error('Error processing binary data:', error);
      throw new Error(`Failed to process binary data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static mergeNumericProps<T>(
    prev: { [Property in keyof T]: BinaryDataBuffer },
    cur: { [Property in keyof T]: BinaryDataBuffer }
  ): { [Property in keyof T]: BinaryDataBuffer } {
    const merged: { [Property in keyof T]: BinaryDataBuffer } = {...prev};

    for (const key in cur) {
      if (prev[key] && cur[key]) {
        // Create appropriate typed arrays based on the current data type
        const prevArray = new Float64Array(prev[key].value);
        const curArray = new Float64Array(cur[key].value);
        const mergedArray = new Float64Array(prevArray.length + curArray.length);

        mergedArray.set(prevArray);
        mergedArray.set(curArray, prevArray.length);

        merged[key] = {
          size: cur[key].size,
          value: mergedArray.buffer
        };
      } else if (cur[key]) {
        // If only current has the property, use it
        merged[key] = cur[key];
      }
    }

    return merged;
  }

  private static numericPropsHelper(props: { [key: string]: BinaryDataBuffer }): { [key: string]: BinaryAttribute } {
    const result: { [key: string]: BinaryAttribute } = {};

    // Safely process each expected numeric property
    const expectedProps = ['sourceTimestamp', 'destinationTimestamp', 'distanceKm', 'distanceTravelledKm'];

    for (const propName of expectedProps) {
      if (props[propName] && props[propName].value) {
        result[propName] = {
          size: props[propName].size,
          value: new Float64Array(props[propName].value)
        };
      }
    }

    return result;
  }

  public static BinaryFeaturesPlaceholder(): [BinaryPointFeature, BinaryPolygonFeature] {
    return [
      {
        type: "Point",
        featureIds: { size: 1, value: new Uint16Array() },
        globalFeatureIds: { size: 1, value: new Uint16Array() },
        positions: { size: 2, value: new Float32Array() },
        numericProps: {},
        properties: []
      }, {
        type: "Polygon",
        featureIds: { size: 1, value: new Uint16Array() },
        globalFeatureIds: { size: 1, value: new Uint16Array() },
        positions: { size: 2, value: new Float32Array() },
        polygonIndices: { size: 1, value: new Uint16Array() },
        primitivePolygonIndices: { size: 1, value: new Uint16Array() },
        numericProps: {},
        properties: []
      }];
  }

  public static emptyBinaryAnimalMovementLineResponse(
    responseType: "BinaryLineString" | "AggregatedEvents"
  ): BinaryAnimalMovementLineResponse<AnimalMovementEvent> {
    return {
      type: responseType,
      index: 0,
      length: 0,
      individualLocalIdentifier: "none",
      featureId: { size: 3, value: new Uint8Array().buffer },
      globalFeatureIds: { size: 3, value: new Uint16Array().buffer },
      pathIndices: { size: 3, value: new Int8Array().buffer },
      numericProps: {
        distanceTravelledKm: { size: 3, value: new Float64Array().buffer },
        sourceTimestamp: { size: 3, value: new Float64Array().buffer },
        destinationTimestamp: { size: 3, value: new Float64Array().buffer },
        distanceKm: { size: 3, value: new Float64Array().buffer },
      } as BinaryAttributeMap<AnimalMovementEvent>,
      position: { size: 3, value: new Float32Array().buffer },
      colors: { size: 3, value: new Uint8Array().buffer },
      content: { contentArray: [] }
    };
  }

  // Legacy method for backward compatibility
  public static emptyBinaryLineStringResponse(
    responseType: "BinaryLineString" | "AggregatedEvents"
  ): BinaryAnimalMovementLineResponse<AnimalMovementEvent> {
    return this.emptyBinaryAnimalMovementLineResponse(responseType);
  }
}
