/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";

export const enum WithClipVolume {
  No,
  Yes,
}

/** Specifies how a TechniqueFlags handles feature table/overrides. */
export const enum FeatureMode {
  None,       // no features
  Pick,       // feature table only
  Overrides,  // feature table with symbology overrides
}

/** Flags used to control which shader program is used by a rendering Technique. */
export class TechniqueFlags {
  public featureMode: FeatureMode;
  public isTranslucent: boolean;
  public hasClipVolume: boolean;
  private _isHilite: boolean;

  public constructor(translucent: boolean = false) {
    this.isTranslucent = translucent;
    this.hasClipVolume = this._isHilite = false;
    this.featureMode = FeatureMode.None;
  }

  public init(target: Target, pass: RenderPass): void {
    const hasClip = target.hasClipVolume || target.hasClipMask;
    if (RenderPass.Hilite === pass) {
      this.initForHilite(hasClip ? WithClipVolume.Yes : WithClipVolume.No);
    } else {
      this._isHilite = false;
      this.hasClipVolume = hasClip;
      this.isTranslucent = RenderPass.Translucent === pass;

      if (undefined !== target.currentOverrides) {
        this.featureMode = FeatureMode.Overrides;
      } else if (undefined !== target.currentPickTable) {
        this.featureMode = FeatureMode.Pick;
      } else {
        this.featureMode = FeatureMode.None;
      }
    }
  }

  public get hasFeatures() { return FeatureMode.None !== this.featureMode; }

  public get isHilite() { return this._isHilite; }
  public initForHilite(withClip: WithClipVolume) {
    this.featureMode = FeatureMode.Overrides;
    this._isHilite = true;
    this.hasClipVolume = WithClipVolume.Yes === withClip;
    this.isTranslucent = false;
  }

  public buildDescription(): string {
    const parts = [this.isTranslucent ? "Translucent" : "Opaque"];
    if (this.isHilite)      parts.push("hilite");
    if (this.hasClipVolume) parts.push("clip");
    if (this.hasFeatures)   parts.push(FeatureMode.Pick === this.featureMode ? "pick" : "overrides");
    return parts.join("; ");
  }

  public static readonly defaults = new TechniqueFlags();
}
