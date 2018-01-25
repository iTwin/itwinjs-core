/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

/** Describes the dimensionality of a texture used as a look-up table. */
export const enum LUTDimension {
  Uniform, //  uniform lookup table
  NonUniform, // 1- or 2-dimensional lookup table
}

/** Parameters passed to shader programs describing the structure of a lookup table.
 * m_texWidth = width of the texture
 * m_texStep = { stepX, centerX, stepY, centerY }, where 'center' refers to the center
 * point of the top-left texel, and 'step' indicates the distance from the center of
 * one texel to the next.
 * Note that for 1-dimensional lookup tables, we could skip the center/stepY and width,
 * but this produces far too many shader variants so we always send all the params.
 */
export class LUTParams {
  public texStep: [number, number, number, number];
  public texWidth: number;

  public init(width: number, height: number): void {
    assert(0 < width && 0 < height);

    // NB: We used to create separate shader variations for 1d and 2d look-up tables. 1d doesn't require stepY, centerY, or width.
    // But we were approaching 1000 shaders...so now we combine 1d and 2d to reduce that.
    const stepX: number = 1.0 / width;
    const stepY: number = 1.0 / height;

    this.texWidth = width;
    this.texStep[0] = stepX;
    this.texStep[1] = stepX * 0.5;
    this.texStep[2] = stepY;
    this.texStep[3] = stepY * 0.5;
  }

  public copyFrom(src: LUTParams): void {
    this.texStep[0] = src.texStep[0];
    this.texStep[1] = src.texStep[1];
    this.texStep[2] = src.texStep[2];
    this.texStep[3] = src.texStep[3];
    this.texWidth = src.texWidth;
  }

  public clone(result?: LUTParams): LUTParams {
    if (!result) {
      return new LUTParams();
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: LUTParams): boolean {
    return this.texStep[0] === rhs.texStep[0]
        && this.texStep[1] === rhs.texStep[1]
        && this.texStep[2] === rhs.texStep[2]
        && this.texStep[3] === rhs.texStep[3]
        && this.texWidth === rhs.texWidth;
  }
}

/** Describes the type of geometry rendered by a ShaderProgram. */
export const enum GeometryType {
  IndexedTriangles,
  IndexedPoints,
  ArrayedPoints,
}

/** Reserved texture units for specific sampler variables, to avoid conflicts between
 * shader components which each have their own textures.
 */
export const enum TextureUnit {
    // For shaders which know exactly which textures will be used
    Zero = 0,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7, // Last one available for GLES2

    NonUniformColor = Zero,
    FeatureSymbology = One,
    MeshTexture = Two,
    LineCode = Two,
    Point = Two,
    ElementId = Three,

    PickElementId0 = Four,
    PickElementId1 = Five,
    PickDepthAndOrder = Six,
}

export const enum FeatureDimension {
  kEmpty,
  kSingleUniform,
  kSingleNonUniform,
  kMultiple,
  kCOUNT,
}

export const enum FeatureIndexType {
  kEmpty,
  kUniform,
  kNonUniform,
}

/** Describes the dimensionality of feature lookup based on the combination of:
 * - # of features contained in Primitive (0, 1, or multiple); and
 * - dimensionality of FeatureTable (uniform, 1d, or 2d).
 * Note if Primitive contains multiple features, FeatureTable by definition is not uniform.
 */
export class FeatureDimensions {
  private value: FeatureDimension;

  public constructor(val?: FeatureDimension) {
    if (val === undefined) {
      this.value = FeatureDimension.kEmpty;
    } else {
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

  public static empty(): FeatureDimensions { return new FeatureDimensions (FeatureDimension.kEmpty); }
  public static singleUniform(): FeatureDimensions { return new FeatureDimensions (FeatureDimension.kSingleUniform); }
  public static singleNonUniform(): FeatureDimensions { return new FeatureDimensions (FeatureDimension.kSingleNonUniform); }
  public static multiple(): FeatureDimensions { return new FeatureDimensions (FeatureDimension.kMultiple); }

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
  private current: FeatureDimensions;
  public begin(): FeatureDimensions { this.current = FeatureDimensions.empty(); return this.current; }
  public end(): FeatureDimensions { return FeatureDimensions.multiple(); }
  public next(): FeatureDimensions | undefined {
    if (this.current.equals(FeatureDimensions.empty())) {
      this.current = FeatureDimensions.singleUniform();
      return this.current;
    } else if (this.current.equals(FeatureDimensions.singleUniform())) {
      this.current = FeatureDimensions.singleNonUniform();
      return this.current;
    } else if (this.current.equals(FeatureDimensions.singleNonUniform())) {
      this.current = FeatureDimensions.multiple();
      return this.current;
    } else {
      return undefined;
    }
  }
}
