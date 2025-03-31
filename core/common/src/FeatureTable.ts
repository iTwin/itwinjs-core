/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  assert, compareNumbers, compareStrings, Id64, Id64String, IndexedValue, IndexMap, UintArray,
} from "@itwin/core-bentley";
import { GeometryClass } from "./GeometryParams.js";
import { PackedFeatureTable } from "./internal/PackedFeatureTable.js";

/** Describes a discrete entity within a batched [RenderGraphic]($frontend) that can be
 * grouped with other such entities in a [[FeatureTable]].
 * Features roughly correlate to elements: a [Tile]($frontend)'s graphics combines geometry from every
 * [GeometricElement]($backend) that intersects the tile's volume, so each element produces at least one feature.
 * However, an element's geometry stream can contain geometry belonging to multiple different combinations of [SubCategory]($backend) and
 * [[GeometryClass]], so an individual element may produce more than one feature.
 * @see [[FeatureOverrides]] for customizing the appearance of individual features.
 * @public
 */
export class Feature {
  public readonly elementId: Id64String;
  public readonly subCategoryId: Id64String;
  public readonly geometryClass: GeometryClass;

  public constructor(elementId: Id64String = Id64.invalid, subCategoryId: Id64String = Id64.invalid, geometryClass: GeometryClass = GeometryClass.Primary) {
    this.elementId = elementId;
    this.subCategoryId = subCategoryId;
    this.geometryClass = geometryClass;
  }

  public get isDefined(): boolean { return !Id64.isInvalid(this.elementId) || !Id64.isInvalid(this.subCategoryId) || this.geometryClass !== GeometryClass.Primary; }
  public get isUndefined(): boolean { return !this.isDefined; }

  /** Returns true if this feature is equivalent to the supplied feature. */
  public equals(other: Feature): boolean { return 0 === this.compare(other); }

  /** Performs ordinal comparison of this feature with another.
   * @param rhs The feature to compare with.
   * @returns zero if the features are equivalent, a negative value if this feature compares as "less than" `rhs`, or a positive value if this feature compares "greater than" `rhs`.
   */
  public compare(rhs: Feature): number {
    if (this === rhs)
      return 0;

    let cmp = compareNumbers(this.geometryClass, rhs.geometryClass);
    if (0 === cmp) {
      cmp = compareStrings(this.elementId, rhs.elementId);
      if (0 === cmp) {
        cmp = compareStrings(this.subCategoryId, rhs.subCategoryId);
      }
    }

    return cmp;
  }
}

/** A [[Feature]] with a modelId identifying the model containing the feature, obtained from a [[RenderFeatureTable]].
 * @public
 */
export interface ModelFeature {
  modelId: Id64String;
  elementId: Id64String;
  subCategoryId: Id64String;
  geometryClass: GeometryClass;
}

/** @public */
export namespace ModelFeature {
  /** Create a ModelFeature of [[GeometryClass.Primary]] with all invalid Ids.
   * This is primarily useful for creating a `result` argument for [[RenderFeatureTable.findFeature]] and [[RenderFeatureTable.getFeature]].
   */
  export function create(): ModelFeature {
    return {
      modelId: Id64.invalid,
      elementId: Id64.invalid,
      subCategoryId: Id64.invalid,
      geometryClass: GeometryClass.Primary,
    };
  }

  /** Returns `true` if any of `feature`'s properties differ from the defaults (invalid Ids and [[GeometryClass.Primary]]). */
  export function isDefined(feature: ModelFeature): boolean {
    return !Id64.isInvalid(feature.modelId) || !Id64.isInvalid(feature.elementId) || !Id64.isInvalid(feature.subCategoryId) || feature.geometryClass !== GeometryClass.Primary;
  }

  /** @alpha */
  export function unpack(packed: PackedFeature, result: ModelFeature, unpackedModelId?: Id64String): ModelFeature {
    result.modelId = unpackedModelId ?? Id64.fromUint32PairObject(packed.modelId);
    result.elementId = Id64.fromUint32PairObject(packed.elementId);
    result.subCategoryId = Id64.fromUint32PairObject(packed.subCategoryId);
    result.geometryClass = packed.geometryClass;
    return result;
  }
}

/** Represents a [[Feature]] within a [[RenderFeatureTable]]. This representation is optimized for use on the GPU.
 * @public
 */
export interface PackedFeature {
  modelId: Id64.Uint32Pair;
  elementId: Id64.Uint32Pair;
  subCategoryId: Id64.Uint32Pair;
  geometryClass: GeometryClass;
  /** @alpha */
  animationNodeId: number;
}

/** Represents a [[PackedFeature]] obtained from a [[RenderFeatureTable]], including the index of that feature within the table.
 * @public
 */
export interface PackedFeatureWithIndex extends PackedFeature {
  index: number;
}

/** @public */
export namespace PackedFeature {
  /** Create a PackedFeature of [[GeometryClass.Primary]] with all invalid Ids.
   * This is primarily useful for creating a `result` argument for [[RenderFeatureTable.getPackedFeature]].
   */
  export function create(): PackedFeature {
    const pair = { upper: 0, lower: 0 };
    return {
      modelId: { ...pair },
      elementId: { ...pair },
      subCategoryId: { ...pair },
      geometryClass: GeometryClass.Primary,
      animationNodeId: 0,
    };
  }

  /** Create a PackedFeatureWithIndex of [[GeometryClass.Primary]] with all invalid Ids and an index of zero.
   * This is primarily useful for creating a reusable `output` argument for [[RenderFeatureTable.iterable]].
   */
  export function createWithIndex(): PackedFeatureWithIndex {
    const result = create() as PackedFeatureWithIndex;
    result.index = 0;
    return result;
  }
}

/** Describes the type of a 'batch' of graphics representing multiple [[Feature]]s.
 * The most commonly-encountered batches are Tiles, which can be of either Primary or
 * Classifier type.
 * @public
 * @extensions
 */
export enum BatchType {
  /** This batch contains graphics derived from a model's visible geometry. */
  Primary,
  /**
   * This batch contains color volumes which are used to classify a model's visible geometry.
   * The graphics themselves are not rendered to the screen; instead they are rendered to the stencil buffer
   * to resymbolize the primary geometry.
   */
  VolumeClassifier,
  /**
   * This batch contains planar graphics which are used to classify a model's visible geometry.
   * The graphics themselves are not rendered to the screen; instead they are rendered to a texture buffer
   * to resymbolize the primary geometry.
   */
  PlanarClassifier,
}

/** Defines a look-up table for [[Feature]]s within a batched [RenderGraphic]($frontend). Consecutive 32-bit
 * indices are assigned to each unique Feature. Primitives within the RenderGraphic can
 * use per-vertex indices to specify the distribution of Features within the primitive. The appearance of individual
 * features can be customized using [[FeatureOverrides]]. Typically a [Tile]($frontend) will contain a feature table
 * identifying the elements whose geometry appears within that tile.
 * @see [[FeatureOverrides]] for customizing the appearance of individual features.
 * @public
 */
export class FeatureTable extends IndexMap<Feature> {
  public readonly modelId: Id64String;
  public readonly type: BatchType;

  /** Construct an empty FeatureTable. */
  public constructor(maxFeatures: number, modelId: Id64String = Id64.invalid, type: BatchType = BatchType.Primary) {
    super((lhs, rhs) => lhs.compare(rhs), maxFeatures);
    this.modelId = modelId;
    this.type = type;
  }

  /** Returns the maximum number of [[Feature]]s this FeatureTable can contain. */
  public get maxFeatures(): number { return this._maximumSize; }
  /** Returns true if this table contains at least one [[Feature]] with a valid element and/or subcategory Id. */
  public get anyDefined(): boolean { return this.length > 1 || (1 === this.length && this._array[0].value.isDefined); }
  /** Returns true if this FeatureTable contains exactly one [[Feature]]. */
  public get isUniform(): boolean { return 1 === this.length; }
  /** If this FeatureTable contains exactly one [[Feature]], returns that Feature; otherwise returns undefined. */
  public get uniform(): Feature | undefined { return 1 === this.length ? this._array[0].value : undefined; }
  /** Returns true if this FeatureTable is associated with [[BatchType.VolumeClassifier]] geometry. */
  public get isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this.type; }
  /** Returns true if this FeatureTable is associated with [[BatchType.PlanarClassifier]] geometry. */
  public get isPlanarClassifier(): boolean { return BatchType.PlanarClassifier === this.type; }

  /** Returns the Feature corresponding to the specified index, or undefined if the index is not present. */
  public findFeature(index: number): Feature | undefined {
    for (const entry of this._array)
      if (entry.index === index)
        return entry.value;

    return undefined;
  }

  /** Inserts the specified [[Feature]] at the specified index. This is really only useful when reconstructing a previously-create feature table
   * for which you know the index assigned to each feature.
   */
  public insertWithIndex(feature: Feature, index: number): void {
    const bound = this.lowerBound(feature);
    assert(!bound.equal);
    assert(!this.isFull);
    const entry = new IndexedValue<Feature>(feature, index);
    this._array.splice(bound.index, 0, entry);
  }

  /** Access the underlying array containing the table's current contents. */
  public getArray(): ReadonlyArray<IndexedValue<Feature>> { return this._array; }

  /** Convert this feature table to a representation that can be supplied to [RenderSystem.createBatch]($frontend). */
  public pack(): RenderFeatureTable {
    return PackedFeatureTable.pack(this);
  }
}

/** @alpha */
export type ComputeNodeId = (feature: PackedFeatureWithIndex) => number;

/** Representation of a [[FeatureTable]] suitable for use with [RenderSystem.createBatch]($frontend).
 * The [[Feature]]s are represented as [[PackedFeature]]s. The feature table may contain features from multiple [Model]($backend)s.
 * @see [[FeatureTable.pack]] to produce a RenderFeatureTable.
 * @public
 */
export interface RenderFeatureTable {
  /** The "model Id" of the tile tree containing the tile from which this feature table originated.
   * It may be a transient Id if, for example, the tile tree represents a reality model or represents the geometry of multiple
   * persistent models batched together.
   */
  readonly batchModelId: Id64String;
  /** A split representation of [[batchModelId]], to avoid having to constantly having to parse the string. */
  readonly batchModelIdPair: Id64.Uint32Pair;
  /** The number of features in the table; equivalently, one more than the largest feature index. */
  readonly numFeatures: number;
  /** The number of bytes consumed by the feature table, strictly for diagnostic purposes. */
  readonly byteLength: number;
  readonly type: BatchType;
  /** @alpha */
  animationNodeIds?: UintArray;

  /** Get the feature at the specified index. The caller is responsible for validating featureIndex less than numFeatures. */
  getFeature(featureIndex: number, result: ModelFeature): ModelFeature;

  /** Find the feature at the specified index. Returns undefined if featureIndex >= [[numFeatures]]. */
  findFeature(featureIndex: number, result: ModelFeature): ModelFeature | undefined;

  /** Find the Id of the element associated with the feature at the specified index. */
  findElementId(featureIndex: number): Id64String | undefined;

  /** Get the Id of the element associated with the feature at the specified index as a pair of 32-bit integers.
   * The caller is responsible for validating that `featureIndex` is less than [[numFeatures]].
   */
  getElementIdPair(featureIndex: number, out: Id64.Uint32Pair): Id64.Uint32Pair;

  /** Get the feature at the specified index. The caller is responsible for validating featureIndex less than numFeatures. */
  getPackedFeature(featureIndex: number, result: PackedFeature): PackedFeature;

  /** Get an object that provides ordered iteration over all features.
   * @note The `output` object is reused (mutated in place) as the current value on each iteration.
   */
  iterable(output: PackedFeatureWithIndex): Iterable<PackedFeatureWithIndex>;

  /** @alpha */
  populateAnimationNodeIds(computeNodeId: ComputeNodeId, maxNodeId: number): void;

  /** @alpha */
  getAnimationNodeId(featureIndex: number): number;

  /** Get the Id of the model associated with the feature at the specified index.
   * The caller is responsible for validating that `featureIndex` is less than [[numFeatures]].
   * This is more efficient than [[getFeature]] for callers who are only interested in the model Id.
   */
  getModelIdPair(featureIndex: number, out: Id64.Uint32Pair): Id64.Uint32Pair;
}
