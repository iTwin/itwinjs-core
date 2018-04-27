/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { FeatureIndexType } from "@bentley/imodeljs-common";

/** Describes the dimensionality of a texture used as a look-up table. */
export const enum LUTDimension {
  Uniform, //  uniform lookup table
  NonUniform, // 1- or 2-dimensional lookup table
}

/**
 * Describes the dimensions of a texture used as a look-up table meeting the following constraints:
 *    - Dimensions < max texture size
 *        - Dimensions < max texture size
 *        - in practice expect at least 2048 and most tablets/phones at least 4096 (96.3% of all browsers according to webglstats.com)
 *    - Roughly square to reduce unused bytes at end of last row
 *    - No extra unused bytes at end of each row
 */
export class LUTDimensions {
  public readonly width: number;
  public readonly height: number;

  public constructor(nEntries: number, nRgbaPerEntry: number, maxSize: number) {
    const smaxSize = 8192;
    const nRgba = nEntries * nRgbaPerEntry;
    if (maxSize > smaxSize)
      maxSize = smaxSize;

    if (nRgba < maxSize) {
      this.width = nRgba;
      this.height = 1;
      return;
    }

    // Make roughly square to reduce unused space in last row
    let width = Math.ceil(Math.sqrt(nRgba));

    // Ensure a given entry's RGBA values all fit on the same row.
    const remainder = width % nRgbaPerEntry;
    width += nRgbaPerEntry - remainder;

    // Compute height
    let height = nRgba / width;
    if (width * height < nRgba)
      ++height;

    assert(height <= maxSize);
    assert(width <= maxSize);
    assert(width * height >= nRgba);

    // Row padding should never be necessary...
    assert(0 === width % nRgbaPerEntry);

    this.width  = width;
    this.height = height;
  }
}

export const enum FeatureDimension {
  kEmpty,
  kSingleUniform,
  kSingleNonUniform,
  kMultiple,
  kCOUNT,
}

export function getFeatureName(dim: FeatureDimension): string | undefined {
  switch (dim) {
    case FeatureDimension.kEmpty: return "Empty";
    case FeatureDimension.kSingleUniform: return "Single/Uniform";
    case FeatureDimension.kSingleNonUniform: return "Single/Non-uniform";
    case FeatureDimension.kMultiple: return "Multiple";
    default: return undefined;
  }
}

/** Describes the dimensionality of feature lookup based on the combination of:
 * - number of features contained in Primitive (0, 1, or multiple); and
 * - dimensionality of FeatureTable (uniform, 1d, or 2d).
 * Note if Primitive contains multiple features, FeatureTable by definition is not uniform.
 */
export class FeatureDimensions {
  private value: FeatureDimension;

  public constructor(val?: FeatureDimension) {
    if (val === undefined) {
      this.value = FeatureDimension.kEmpty;
    } else {
      assert((val as number) < (FeatureDimension.kCOUNT as number));
      this.value = val;
    }
  }

  public copyFrom(src: FeatureDimensions): void {
    this.value = src.value;
  }

  public clone(result?: FeatureDimensions): FeatureDimensions {
    if (!result) {
      return new FeatureDimensions();
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public init(dim: LUTDimension, type: FeatureIndexType): void {
    if (type === FeatureIndexType.kEmpty) {
      this.value = FeatureDimension.kEmpty;
    } else if (type === FeatureIndexType.kNonUniform) {
      assert(LUTDimension.Uniform !== dim);
      this.value = FeatureDimension.kMultiple;
    } else {
      if (LUTDimension.Uniform === dim) {
        this.value = FeatureDimension.kSingleUniform;
      } else {
        this.value = FeatureDimension.kSingleNonUniform;
      }
    }
  }

  public static empty(): FeatureDimensions { return new FeatureDimensions(FeatureDimension.kEmpty); }
  public static singleUniform(): FeatureDimensions { return new FeatureDimensions(FeatureDimension.kSingleUniform); }
  public static singleNonUniform(): FeatureDimensions { return new FeatureDimensions(FeatureDimension.kSingleNonUniform); }
  public static multiple(): FeatureDimensions { return new FeatureDimensions(FeatureDimension.kMultiple); }

  public getValue(): number { return this.value as number; }

  public equals(rhs: FeatureDimensions): boolean { return this.value === rhs.value; }
  public lessThan(rhs: FeatureDimensions): boolean { return this.value < rhs.value; }

  public isEmpty() { return FeatureDimension.kEmpty === this.value; }
  public isSingle() { return FeatureDimension.kSingleUniform === this.value || FeatureDimension.kSingleNonUniform === this.value; }
  public isMultiple() { return FeatureDimension.kMultiple === this.value; }
  public isUniform() { return FeatureDimension.kSingleUniform === this.value; }
  public isNonUniform() { return FeatureDimension.kSingleNonUniform === this.value || FeatureDimension.kMultiple === this.value; }

  public getFeatureIndexType(): FeatureIndexType {
    if (this.isEmpty()) {
      return FeatureIndexType.kEmpty;
    } else if (this.isMultiple()) {
      return FeatureIndexType.kNonUniform;
    } else {
      return FeatureIndexType.kUniform;
    }
  }
}

export class FeatureDimensionsIterator {
  private current: FeatureDimension;
  public constructor(value: FeatureDimension) { this.current = value; }
  public static begin(): FeatureDimensionsIterator { return new FeatureDimensionsIterator(FeatureDimension.kEmpty); }
  public static end(): FeatureDimensionsIterator { return new FeatureDimensionsIterator(FeatureDimension.kCOUNT); }
  public equals(rhs: FeatureDimensionsIterator): boolean { return this.current === rhs.current; }
  public next(): void {
    this.current = (this.current.valueOf() + 1) as FeatureDimension;
  }
  public get(): FeatureDimensions { return new FeatureDimensions(this.current); }
}
