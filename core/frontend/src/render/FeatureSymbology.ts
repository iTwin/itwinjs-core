/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { LinePixels, ColorDef, RgbColor, Cloneable } from "@bentley/imodeljs-common";
import { Id64Set } from "@bentley/bentleyjs-core";
import { ViewState } from "../ViewState";
import { IModelConnection } from "../IModelConnection";

export namespace FeatureSymbology {
  export class Appearance implements Cloneable<Appearance> {
    public rgb?: RgbColor;
    public weight?: number;
    public alpha?: number;
    public linePixels?: LinePixels;
    public ignoresMaterial: boolean = false;

    public get overridesSymbology() { return this.overridesRgb || this.overridesAlpha || this.overridesWeight || this.overridesLinePixels || this.ignoresMaterial; }
    public get overridesRgb() { return undefined !== this.rgb; }
    public get overridesAlpha() { return undefined !== this.alpha; }
    public get overridesLinePixels() { return undefined !== this.linePixels; }
    public get overridesWeight() { return undefined !== this.weight; }

    public extend(app: Appearance): Appearance {
      if (!app.overridesRgb) app.rgb = this.rgb;
      if (!app.overridesAlpha) app.alpha = this.alpha;
      if (!app.overridesWeight) app.weight = this.weight;
      if (!app.overridesLinePixels) app.linePixels = this.linePixels;
      if (!app.ignoresMaterial) app.ignoresMaterial = this.ignoresMaterial;
      return app;
    }

    public clone(): Appearance {
      const app = new Appearance();
      app.extend(this);
      return app;
    }

    public static fromRgb(rgb: ColorDef): Appearance {
      const app = new Appearance();
      app.rgb = RgbColor.fromColorDef(rgb);
      return app;
    }

    public static fromRgba(rgba: ColorDef) {
      const app = new Appearance();
      app.rgb = RgbColor.fromColorDef(rgba);
      app.alpha = rgba.getAlpha();
      return app;
    }

    // public initFrom(over: DgnSubCategoryOverride) { }
  }

  export class Overrides {
    public alwaysDrawn?: Id64Set;
    public neverDrawn?: Id64Set;
    public readonly modelOverrides = new Map<string, Appearance>();
    public readonly elementOverrides = new Map<string, Appearance>();
    public readonly visibleSubCategories = new Set<string>();
    public readonly subcategoryOverrides = new Map<string, Appearance>();
    public defaultOverrides = new Appearance();
    public constructions = false;
    public dimensions = false;
    public patterns = false;
    public alwaysDrawnExclusive = false;
    public lineWeights = true;

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

    /** #TODO */
    public async updateFromIModel(_iModel: IModelConnection): Promise<void> {
      // Features are defined by subcategory, which only implies category...
      // A subcategory is visible if it belongs to a viewed category and its appearance's visibility flag is set
      // const ecsql = `SELECT ECInstanceId FROM BisCore.SubCategory WHERE InVirtualSet(?, Parent.Id)`;
      // const stmt = await iModel.executeQuery(ecsql);
      return Promise.resolve();
    }

    public async initFromView(view: ViewState): Promise<void> {
      this.alwaysDrawn = view.alwaysDrawn;
      this.neverDrawn = view.neverDrawn;

      const vf = view.viewFlags;
      this.constructions = vf.constructions;
      this.dimensions = vf.dimensions;
      this.patterns = vf.patterns;
      this.lineWeights = vf.showWeights();

      await this.updateFromIModel(view.iModel);
    }

    constructor(view?: ViewState) {
      if (!!view) this.initFromView(view);
    }
  }
}
