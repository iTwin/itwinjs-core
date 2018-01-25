/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { LUTDimension, getFeatureName, FeatureDimensions, FeatureIndexType, FeatureDimension } from "./FeatureDimensions";

// Specifies whether an 'active clip volume' has been applied to the view.
export const enum WithClipVolume { No, Yes }

export const enum Mode {
  kMode_Normal = 0,
  kMode_Hilite = 1,
}

export class TechniqueFlags {
  public featureDimensions: FeatureDimensions = FeatureDimensions.empty();
  public mode: Mode = Mode.kMode_Normal;
  public monochrome: boolean = false;
  public clipVolume: boolean = false;
  public featureOverrides: boolean = false;

  public get featureDimensionType(): FeatureDimension { return this.featureDimensions.getValue(); }
  public get isMonochrome(): boolean { return this.monochrome; }
  public get isTranslucent(): boolean { return this.translucent; }
  public get hasClipVolume(): boolean { return this.clipVolume; }
  public get isUniformColor(): boolean { return this.colorDimension === LUTDimension.Uniform; }
  public get isHilite(): boolean { return this.mode === Mode.kMode_Hilite; }
  public get hasFeatureDimensions(): boolean { return !this.featureDimensions.isEmpty(); }
  public get colorStr(): string { return `${this.isUniformColor ? "Uniform" : "Non-uniform"} color`; }
  public get monochromeStr(): string | undefined { return this.isMonochrome ? "monochrome" : undefined; }
  public get translucentStr(): string | undefined { return this.isTranslucent ? "translucent" : undefined; }
  public get hiliteStr(): string | undefined { return this.isHilite ? "hilite" : undefined; }
  public get clipVolumeStr(): string | undefined { return this.hasClipVolume ? "clip" : undefined; }
  public get featureOverrideStr(): string { return getFeatureName(this.featureDimensionType) + " feature overrides"; }
  public get descriptors(): Array<string | undefined> { return [this.colorStr, this.translucentStr, this.monochromeStr, this.hiliteStr, this.clipVolumeStr, this.featureOverrideStr].filter(Boolean); }
  public get description(): string { return this.descriptors.join("; "); }

  constructor(public colorDimension: LUTDimension = LUTDimension.Uniform, public translucent: boolean = false) {}

  public setFeatureDimensions(type: FeatureIndexType, dim: LUTDimension): void { this.featureDimensions.init(dim, type); }
  public setHilite(): void { this.mode = Mode.kMode_Hilite; }
  public static forHilite(dims: FeatureDimensions, withClipVolume: WithClipVolume, techniqueFlags: TechniqueFlags = new TechniqueFlags() ): TechniqueFlags {
    // The hilite shader simply generates a silhouette...the other flags are superfluous.
    techniqueFlags.featureDimensions = dims;
    techniqueFlags.mode = Mode.kMode_Hilite;
    techniqueFlags.clipVolume = withClipVolume === WithClipVolume.Yes;
    return techniqueFlags;
  }
}
