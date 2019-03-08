/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";
import { ClippingType } from "../System";

/** Specifies how a TechniqueFlags handles feature table/overrides. */
export const enum FeatureMode {
  None,       // no features
  Pick,       // feature table only
  Overrides,  // feature table with symbology overrides
}

/** Meta data for what type of clip volume is being stored (mask or planes). */
export class ClipDef {
  public type: ClippingType;
  public numberOfPlanes: number;

  public constructor(type: ClippingType = ClippingType.None, numberOfPlanes: number = 0) { this.type = type; this.numberOfPlanes = numberOfPlanes; }
  public static forMask() { return new ClipDef(ClippingType.Mask); }
  public static forPlanes(numPlanes: number) { return new ClipDef(ClippingType.Planes, numPlanes); }
}

export const enum IsInstanced { No, Yes }
export const enum IsAnimated { No, Yes }
export const enum IsClassified { No, Yes }

/** Flags used to control which shader program is used by a rendering Technique. */
export class TechniqueFlags {
  public clip: ClipDef = new ClipDef();
  public featureMode = FeatureMode.None;
  public isTranslucent: boolean;
  public isAnimated: IsAnimated = IsAnimated.No;
  public isInstanced: IsInstanced = IsInstanced.No;
  public isClassified: IsClassified = IsClassified.No;
  private _isHilite = false;

  public constructor(translucent: boolean = false) {
    this.isTranslucent = translucent;
  }

  public get hasClip(): boolean { return this.clip.type !== ClippingType.None; }

  public init(target: Target, pass: RenderPass, instanced: IsInstanced, animated: IsAnimated = IsAnimated.No, classified = IsClassified.No): void {
    if (RenderPass.Hilite === pass || RenderPass.HiliteClassification === pass || RenderPass.HilitePlanarClassification === pass) {
      this.initForHilite(target.clipDef, instanced, (classified === IsClassified.Yes && RenderPass.HilitePlanarClassification === pass) ? IsClassified.Yes : IsClassified.No);
    } else {
      this._isHilite = false;
      this.isTranslucent = RenderPass.Translucent === pass;
      this.clip = target.clipDef;
      this.isAnimated = animated;
      this.isInstanced = instanced;
      this.isClassified = classified;

      if (undefined !== target.currentOverrides)
        this.featureMode = FeatureMode.Overrides;
      else if (0 !== target.currentBatchId)
        this.featureMode = FeatureMode.Pick;
      else
        this.featureMode = FeatureMode.None;
    }
  }

  public reset(mode: FeatureMode, instanced: IsInstanced = IsInstanced.No, isTranslucent: boolean = false) {
    this._isHilite = false;
    this.featureMode = mode;
    this.isTranslucent = isTranslucent;
    this.isAnimated = IsAnimated.No;
    this.isClassified = IsClassified.No;
    this.isInstanced = instanced;
    this.clip.type = ClippingType.None;
    this.clip.numberOfPlanes = 0;
  }

  public get hasFeatures() { return FeatureMode.None !== this.featureMode; }

  public setAnimated(animated: boolean) { this.isAnimated = animated ? IsAnimated.Yes : IsAnimated.No; }
  public setInstanced(instanced: boolean) { this.isInstanced = instanced ? IsInstanced.Yes : IsInstanced.No; }
  public setClassified(classified: boolean) {
    this.isClassified = classified ? IsClassified.Yes : IsClassified.No;
  }

  public get isHilite() { return this._isHilite; }
  public initForHilite(clip: ClipDef, instanced: IsInstanced, classified: IsClassified) {
    this.featureMode = classified ? FeatureMode.None : FeatureMode.Overrides;
    this._isHilite = true;
    this.isTranslucent = false;
    this.isAnimated = IsAnimated.No;
    this.isInstanced = instanced;
    this.isClassified = classified;
    this.clip = clip;
  }

  public buildDescription(): string {
    const parts = [this.isTranslucent ? "Translucent" : "Opaque"];
    if (this.isInstanced) parts.push("instanced");
    if (this.isAnimated) parts.push("animated");
    if (this.isHilite) parts.push("hilite");
    if (this.isClassified) parts.push("classified");
    if (this.hasClip) parts.push("clip");
    if (this.hasFeatures) parts.push(FeatureMode.Pick === this.featureMode ? "pick" : "overrides");
    return parts.join("; ");
  }

  public static readonly defaults = new TechniqueFlags();
}
