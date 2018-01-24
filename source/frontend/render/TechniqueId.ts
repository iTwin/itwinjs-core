/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export enum BuiltInTechniqueId {
  // Techniques with many different variations
  kSurface,
  kPolyline,
  kPointCloud,
  kPointString,
  kEdge,
  kSilhouetteEdge,
  // Techniques with a single associated shader that operates on the entire image
  kCompositeHilite,
  kCompositeTranslucent,
  kCompositeHiliteAndTranslucent,
  kOITClearTranslucent,
  kCopyPickBuffers,
  kCopyColor,
  kClearPickAndColor,

  kCOUNT,
}

export class TechniqueId {
  public value: BuiltInTechniqueId | undefined;

  public constructor(value?: BuiltInTechniqueId | undefined) {
    this.value = value;
  }

  public getValue(): number { return this.value as number; }
  public isValid(): boolean { return this.value !== undefined; }

  // Geometry techniques
  public static surface(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kSurface); }
  public static polyline(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kPolyline); }
  public static pointCloud(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kPointCloud); }
  public static pointString(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kPointString); }
  public static edge(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kEdge); }
  public static silhouetteEdge(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kSilhouetteEdge); }
  // Single, whole image techniques
  public static compositeHilite(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kCompositeHilite); }
  public static compositeTranslucent(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kCompositeTranslucent); }
  public static compositeHiliteAndTranslucent(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kCompositeHiliteAndTranslucent); }
  public static oitClearTranslucent(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kOITClearTranslucent); }
  public static copyPickBuffers(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kCopyPickBuffers); }
  public static copyColor(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kCopyColor); }
  public static clearPickAndColor(): TechniqueId { return new TechniqueId(BuiltInTechniqueId.kClearPickAndColor); }

  public static numBuiltIn(): number { return BuiltInTechniqueId.kCOUNT as number; }
}
