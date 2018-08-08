/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

/** Flags used to control which shader program is used by a rendering Technique. */
export class TechniqueFlags {
  public clip: ClipDef;
  public featureMode: FeatureMode;
  public isTranslucent: boolean;
  private _isHilite: boolean;

  public constructor(translucent: boolean = false) {
    this.isTranslucent = translucent;
    this._isHilite = false;
    this.featureMode = FeatureMode.None;
    this.clip = new ClipDef();
  }

  public get hasClip(): boolean { return this.clip.type !== ClippingType.None; }

  public init(target: Target, pass: RenderPass): void {
    if (RenderPass.Hilite === pass) {
      this.initForHilite(target.clipDef);
    } else {
      this._isHilite = false;
      this.isTranslucent = RenderPass.Translucent === pass;
      this.clip = target.clipDef;

      if (undefined !== target.currentOverrides) {
        this.featureMode = FeatureMode.Overrides;
      } else if (undefined !== target.currentPickTable) {
        this.featureMode = FeatureMode.Pick;
      } else {
        this.featureMode = FeatureMode.None;
      }
    }
  }

  public reset(mode: FeatureMode, isTranslucent: boolean = false) {
    this._isHilite = false;
    this.featureMode = mode;
    this.isTranslucent = isTranslucent;
    this.clip.type = ClippingType.None;
    this.clip.numberOfPlanes = 0;
  }

  public get hasFeatures() { return FeatureMode.None !== this.featureMode; }

  public get isHilite() { return this._isHilite; }
  public initForHilite(clip: ClipDef) {
    this.featureMode = FeatureMode.Overrides;
    this._isHilite = true;
    this.isTranslucent = false;
    this.clip = clip;
  }

  public buildDescription(): string {
    const parts = [this.isTranslucent ? "Translucent" : "Opaque"];
    if (this.isHilite) parts.push("hilite");
    if (this.hasClip) parts.push("clip");
    if (this.hasFeatures) parts.push(FeatureMode.Pick === this.featureMode ? "pick" : "overrides");
    return parts.join("; ");
  }

  public static readonly defaults = new TechniqueFlags();
}
