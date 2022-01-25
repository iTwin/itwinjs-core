/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, compareNumbers, compareStrings, Id64, Id64String, IndexedValue, IndexMap } from "@itwin/core-bentley";
import { GeometryClass } from "./GeometryParams";

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
  public readonly elementId: string;
  public readonly subCategoryId: string;
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

/** @internal */
export interface PackedFeature {
  elementId: Id64.Uint32Pair;
  subCategoryId: Id64.Uint32Pair;
  geometryClass: GeometryClass;
  animationNodeId: number;
}

/** Describes the type of a 'batch' of graphics representing multiple [[Feature]]s.
 * The most commonly-encountered batches are Tiles, which can be of either Primary or
 * Classifier type.
 * @public
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
  /** @internal */
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

  /** @internal */
  public insertWithIndex(feature: Feature, index: number): void {
    const bound = this.lowerBound(feature);
    assert(!bound.equal);
    assert(!this.isFull);
    const entry = new IndexedValue<Feature>(feature, index);
    this._array.splice(bound.index, 0, entry);
  }

  /** @internal */
  public getArray(): Array<IndexedValue<Feature>> { return this._array; }
}

/**
 * An immutable, packed representation of a [[FeatureTable]]. The features are packed into a single array of 32-bit integer values,
 * wherein each feature occupies 3 32-bit integers.
 * @internal
 */
export class PackedFeatureTable {
  private readonly _data: Uint32Array;
  public readonly modelId: Id64String;
  public readonly maxFeatures: number;
  public readonly numFeatures: number;
  public readonly anyDefined: boolean;
  public readonly type: BatchType;
  private readonly _animationNodeIds?: Uint8Array | Uint16Array | Uint32Array;

  public get byteLength(): number { return this._data.byteLength; }

  /** Construct a PackedFeatureTable from the packed binary data.
   * This is used internally when deserializing Tiles in iMdl format.
   * @internal
   */
  public constructor(data: Uint32Array, modelId: Id64String, numFeatures: number, maxFeatures: number, type: BatchType, animationNodeIds?: Uint8Array | Uint16Array | Uint32Array) {
    this._data = data;
    this.modelId = modelId;
    this.maxFeatures = maxFeatures;
    this.numFeatures = numFeatures;
    this.type = type;
    this._animationNodeIds = animationNodeIds;

    switch (this.numFeatures) {
      case 0:
        this.anyDefined = false;
        break;
      case 1:
        this.anyDefined = this.getFeature(0).isDefined;
        break;
      default:
        this.anyDefined = true;
        break;
    }

    assert(this._data.length >= this._subCategoriesOffset);
    assert(this.maxFeatures >= this.numFeatures);
    assert(undefined === this._animationNodeIds || this._animationNodeIds.length === this.numFeatures);
  }

  /** Create a packed feature table from a [[FeatureTable]]. */
  public static pack(featureTable: FeatureTable): PackedFeatureTable {
    // We must determine how many subcategories we have ahead of time to compute the size of the Uint32Array, as
    // the array cannot be resized after it is created.
    // We are not too worried about this as FeatureTables created on the front-end will contain few if any features; those obtained from the
    // back-end arrive within tiles already in the packed format.
    const subcategories = new Map<string, number>();
    for (const iv of featureTable.getArray()) {
      const found = subcategories.get(iv.value.subCategoryId.toString());
      if (undefined === found)
        subcategories.set(iv.value.subCategoryId, subcategories.size);
    }

    // We need 3 32-bit integers per feature, plus 2 32-bit integers per subcategory.
    const subCategoriesOffset = 3 * featureTable.length;
    const nUint32s = subCategoriesOffset + 2 * subcategories.size;
    const uint32s = new Uint32Array(nUint32s);

    for (const iv of featureTable.getArray()) {
      const feature = iv.value;
      const index = iv.index * 3;

      let subCategoryIndex = subcategories.get(feature.subCategoryId)!;
      assert(undefined !== subCategoryIndex); // we inserted it above...
      subCategoryIndex |= (feature.geometryClass << 24);

      uint32s[index + 0] = Id64.getLowerUint32(feature.elementId);
      uint32s[index + 1] = Id64.getUpperUint32(feature.elementId);
      uint32s[index + 2] = subCategoryIndex;
    }

    subcategories.forEach((index: number, id: string, _map) => {
      const index32 = subCategoriesOffset + 2 * index;
      uint32s[index32 + 0] = Id64.getLowerUint32(id);
      uint32s[index32 + 1] = Id64.getUpperUint32(id);
    });

    return new PackedFeatureTable(uint32s, featureTable.modelId, featureTable.length, featureTable.maxFeatures, featureTable.type);
  }

  /** Retrieve the Feature associated with the specified index. */
  public getFeature(featureIndex: number): Feature {
    const packed = this.getPackedFeature(featureIndex);
    const elemId = Id64.fromUint32Pair(packed.elementId.lower, packed.elementId.upper);
    const subcatId = Id64.fromUint32Pair(packed.subCategoryId.lower, packed.subCategoryId.upper);
    return new Feature(elemId, subcatId, packed.geometryClass);
  }

  /** Returns the Feature associated with the specified index, or undefined if the index is out of range. */
  public findFeature(featureIndex: number): Feature | undefined {
    return featureIndex < this.numFeatures ? this.getFeature(featureIndex) : undefined;
  }

  /** @internal */
  public getElementIdPair(featureIndex: number): Id64.Uint32Pair {
    assert(featureIndex < this.numFeatures);
    const offset = 3 * featureIndex;
    return {
      lower: this._data[offset],
      upper: this._data[offset + 1],
    };
  }

  /** @internal */
  public getSubCategoryIdPair(featureIndex: number): Id64.Uint32Pair {
    const index = 3 * featureIndex;
    let subCatIndex = this._data[index + 2];
    subCatIndex = (subCatIndex & 0x00ffffff) >>> 0;
    subCatIndex = subCatIndex * 2 + this._subCategoriesOffset;
    return { lower: this._data[subCatIndex], upper: this._data[subCatIndex + 1] };
  }

  /** @internal */
  public getAnimationNodeId(featureIndex: number): number {
    return undefined !== this._animationNodeIds ? this._animationNodeIds[featureIndex] : 0;
  }

  /** @internal */
  public getPackedFeature(featureIndex: number): PackedFeature {
    assert(featureIndex < this.numFeatures);

    const index32 = 3 * featureIndex;
    const elementId = { lower: this._data[index32], upper: this._data[index32 + 1] };

    const subCatIndexAndClass = this._data[index32 + 2];
    const geometryClass = (subCatIndexAndClass >>> 24) & 0xff;

    let subCatIndex = (subCatIndexAndClass & 0x00ffffff) >>> 0;
    subCatIndex = subCatIndex * 2 + this._subCategoriesOffset;
    const subCategoryId = { lower: this._data[subCatIndex], upper: this._data[subCatIndex + 1] };

    const animationNodeId = this.getAnimationNodeId(featureIndex);
    return { elementId, subCategoryId, geometryClass, animationNodeId };
  }

  /** Returns the element ID of the Feature associated with the specified index, or undefined if the index is out of range. */
  public findElementId(featureIndex: number): Id64String | undefined {
    if (featureIndex >= this.numFeatures)
      return undefined;
    else
      return this.readId(3 * featureIndex);
  }

  /** Return true if this table contains exactly 1 feature. */
  public get isUniform(): boolean { return 1 === this.numFeatures; }

  /** If this table contains exactly 1 feature, return it. */
  public get uniform(): Feature | undefined { return this.isUniform ? this.getFeature(0) : undefined; }

  public get isVolumeClassifier(): boolean { return BatchType.VolumeClassifier === this.type; }
  public get isPlanarClassifier(): boolean { return BatchType.VolumeClassifier === this.type; }
  public get isClassifier(): boolean { return this.isVolumeClassifier || this.isPlanarClassifier; }

  /** Unpack the features into a [[FeatureTable]]. */
  public unpack(): FeatureTable {
    const table = new FeatureTable(this.maxFeatures, this.modelId);
    for (let i = 0; i < this.numFeatures; i++) {
      const feature = this.getFeature(i);
      table.insertWithIndex(feature, i);
    }

    return table;
  }

  private get _subCategoriesOffset(): number { return this.numFeatures * 3; }

  private readId(offset32: number): Id64String {
    return Id64.fromUint32Pair(this._data[offset32], this._data[offset32 + 1]);
  }
}
