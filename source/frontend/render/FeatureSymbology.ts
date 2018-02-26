/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { LinePixels } from "../../common/Render";
import { ColorDef } from "../../common/ColorDef";
import { Id64, Id64Set } from "@bentley/bentleyjs-core/lib/Id";
import { Cloneable } from "./Utility";

export namespace FeatureSymbology {
  export class AppearanceFlags {
    public rgb: boolean = false;
    public alpha: boolean = false;
    public weight: boolean = false;
    public linePixels: boolean = false;
    public ignoreMaterial: boolean = false;
    public get hasOverrides(): boolean { return this.rgb || this.alpha || this.weight || this.linePixels || this.ignoreMaterial; }
  }

  export class Appearance implements Cloneable<Appearance> {
    private _weight: number = 0;
    private _color: ColorDef = new ColorDef();
    private _linePixels: LinePixels = LinePixels.Code0;

    public readonly flags: AppearanceFlags = new AppearanceFlags();

    public get alpha(): number { return this._color.getAlpha(); }
    public set alpha(alpha: number) { this.flags.alpha = true; this._color.setAlpha(alpha); }

    public get transparency(): number { return (255 - this._color.getAlpha() / 255); }
    public set transparency(t: number) { this._color.setAlpha(new Uint8Array([ (1 - t) * 255 ])[0]); }

    public get weight(): number { return this._weight; }
    public set weight(w: number) { this.flags.weight = true; this._weight = w; }

    public get rgb(): ColorDef { return this._color; }
    public set rgb(c: ColorDef) {
      const color = c.clone();
      this.flags.rgb = true;
      if (this.overridesAlpha) color.setAlpha(this._color.getAlpha());
      this._color = color;
    }

    public get linePixels(): LinePixels { return this._linePixels; }
    public set linePixels(pix: LinePixels) { this.flags.linePixels = true; this._linePixels = pix; }

    public get ignoresMaterial(): boolean { return this.flags.ignoreMaterial; }
    public set ignoresMaterial(ignore: boolean) { this.flags.ignoreMaterial = ignore; }

    public get overridesSymbology(): boolean { return this.flags.hasOverrides; }
    public get overridesAlpha(): boolean { return this.flags.alpha; }
    public get overridesRgb(): boolean { return this.flags.rgb; }
    public get overridesWeight(): boolean { return this.flags.weight; }
    public get overridesLinePixels(): boolean { return this.flags.linePixels; }

    public extend(app: Appearance): Appearance {
      if (this.overridesRgb && !app.overridesRgb) app.rgb = this.rgb;
      if (this.overridesAlpha && !app.overridesAlpha) app.alpha = this.alpha;
      if (this.overridesWeight && !app.overridesWeight) app.weight = this.weight;
      if (this.overridesLinePixels && !app.overridesLinePixels) app.linePixels = this.linePixels;
      if (this.ignoresMaterial) app.ignoresMaterial = true;
      return app;
    }

    public clone(): Appearance {
      const app = new Appearance();
      app.extend(this);
      return app;
    }

    public static fromRgb(rgb: ColorDef) {
      const app = new Appearance();
      app.rgb = rgb;
      return app;
    }

    public static fromRgba(rgba: ColorDef, alpha?: number) {
      const app = new Appearance();
      app.rgb = rgba;
      app.alpha = (!!alpha) ? alpha : rgba.getAlpha();
      return app;
    }

    // public initFrom(over: DgnSubCategoryOverride) { }
    // public get ovrGraphicParams(): OvrGraphicParams {}
  }

  export class Overrides {
    public alwaysDrawn: Id64Set = new Set<string>();
    public neverDrawn: Id64Set = new Set<string>();
    public modelOverrides: Map<Id64, Appearance> = new Map<Id64, Appearance>();
    public elementOverrides: Map<Id64, Appearance> = new Map<Id64, Appearance>();
    public visibleSubCategories: Id64Set = new Set<string>();
    public subcategoryOverrides: Map<Id64, Appearance> = new Map<Id64, Appearance>();
    public defaultOverrides: Appearance = new Appearance();
    public constructions: boolean = false;
    public dimensions: boolean = false;
    public patterns: boolean = false;
    public alwaysDrawnExclusive: boolean = false;
    public lineWeights: boolean = true;

    // DGNPLATFORM_EXPORT explicit FeatureSymbologyOverrides(ViewControllerCR view);
    // // Returns false if the feature is invisible.
    // // Otherwise, populates the feature's Appearance overrides
    // DGNPLATFORM_EXPORT bool GetAppearance(Appearance&, FeatureCR, DgnModelId) const;
    // DGNPLATFORM_EXPORT bool IsFeatureVisible(FeatureCR) const;
    // DGNPLATFORM_EXPORT bool IsSubCategoryVisible(DgnSubCategoryId) const;
    // DGNPLATFORM_EXPORT bool IsClassVisible(DgnGeometryClass) const;
    // // NB: Appearance can override nothing, which prevents the default overrides from applying to it.
    // DGNPLATFORM_EXPORT void OverrideElement(DgnElementId, Appearance appearance, bool replaceExisting=true);
    // DGNPLATFORM_EXPORT void ClearElementOverrides(DgnElementId);
    // // Specify overrides for all elements within the specified model. These overrides take priority.
    // DGNPLATFORM_EXPORT void OverrideModel(DgnModelId, Appearance, bool replaceExisting=true);
    // DGNPLATFORM_EXPORT void ClearModelOverrides(DgnModelId);
    // DGNPLATFORM_EXPORT void OverrideSubCategory(DgnSubCategoryId, Appearance appearance, bool replaceExisting=true);
    // DGNPLATFORM_EXPORT void ClearSubCategoryOverrides(DgnSubCategoryId);

    public setDefaultOverrides(appearance: Appearance, replaceExisting: boolean = true): void {
      if (replaceExisting || !appearance.overridesSymbology) this.defaultOverrides = appearance.clone();
    }
  }
}
