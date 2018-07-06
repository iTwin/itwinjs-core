/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { LinePixels, ColorDef, RgbColor, Cloneable, Feature, GeometryClass, SubCategoryOverride } from "@bentley/imodeljs-common";
import { Id64Set, Id64 } from "@bentley/bentleyjs-core";
import { ViewState, SpecialElements, DrawnElementSets } from "../ViewState";

export namespace FeatureSymbology {
  export interface AppearanceProps {
    rgb?: RgbColor;
    weight?: number;
    alpha?: number;
    linePixels?: LinePixels;
    ignoresMaterial?: boolean;
  }

  export class Appearance implements AppearanceProps, Cloneable<Appearance> {
    public rgb?: RgbColor;
    public weight?: number;
    public alpha?: number;
    public linePixels?: LinePixels;
    public ignoresMaterial: boolean = false;

    constructor(props?: AppearanceProps) { if (undefined !== props) this.setFrom(props); }

    public get overridesSymbology(): boolean {
      return this.overridesRgb || this.overridesAlpha || this.overridesWeight || this.overridesLinePixels || this.ignoresMaterial;
    }
    public get overridesRgb(): boolean { return undefined !== this.rgb; }
    public get overridesAlpha(): boolean { return undefined !== this.alpha; }
    public get overridesLinePixels(): boolean { return undefined !== this.linePixels; }
    public get overridesWeight(): boolean { return undefined !== this.weight; }

    /** Apply any overrides from this Appearance to the base Appearance, if the base Appearance does not already override them. */
    public extend(app: Appearance): Appearance {
      const { rgb, weight, alpha, linePixels, ignoresMaterial } = this;
      if (!app.overridesRgb) app.rgb = rgb;
      if (!app.overridesAlpha) app.alpha = alpha;
      if (!app.overridesWeight) app.weight = weight;
      if (!app.overridesLinePixels) app.linePixels = linePixels;
      if (!app.ignoresMaterial) app.ignoresMaterial = ignoresMaterial;
      return app;
    }

    public setFrom(props: AppearanceProps): void {
      const { rgb, weight, alpha, linePixels, ignoresMaterial } = props;
      this.rgb = rgb;
      this.alpha = alpha;
      this.weight = weight;
      this.linePixels = linePixels;
      this.ignoresMaterial = ignoresMaterial || false;
    }

    private rgbIsEqual(rgb?: RgbColor): boolean { return undefined === this.rgb ? undefined === rgb ? true : false : undefined === rgb ? false : this.rgb.equals(rgb); }

    public equals(other: Appearance): boolean {
      const { rgb, weight, alpha, linePixels, ignoresMaterial } = other;
      return this.rgbIsEqual(rgb) && this.weight === weight && this.alpha === alpha && this.linePixels === linePixels && this.ignoresMaterial === ignoresMaterial;
    }

    public reset(): void {
      this.rgb = undefined;
      this.alpha = undefined;
      this.weight = undefined;
      this.linePixels = undefined;
      this.ignoresMaterial = false;
    }

    public clone(): Appearance { return new Appearance(this); }

    public static fromRgb(rgb: ColorDef): Appearance {
      const app = new Appearance();
      app.rgb = RgbColor.fromColorDef(rgb);
      return app;
    }

    public static fromRgba(rgba: ColorDef): Appearance {
      const app = new Appearance();
      app.rgb = RgbColor.fromColorDef(rgba);
      app.alpha = rgba.getAlpha();
      return app;
    }

    public initFrom(ovr: SubCategoryOverride) {
      this.weight = ovr.weight;
      if (undefined !== ovr.weight)
        this.weight = ovr.weight;

      if (undefined !== ovr.transparency)
        this.alpha = ovr.transparency;

      if (undefined !== ovr.color)
        this.rgb = RgbColor.fromColorDef(ovr.color);

      if (undefined !== ovr.material) {
        // assert(!ovr.material.isValid); // Disabling material is supported; swapping material is currently not
        if (!ovr.material.isValid)
          this.ignoresMaterial = true;
      }
    }
  }

  export class Overrides implements DrawnElementSets {
    /** Drawn Sets */
    private readonly _specialElements = new SpecialElements();
    public get neverDrawn(): Id64Set { return this._specialElements.neverDrawn; } // Get the list of elements that are never drawn
    public get alwaysDrawn(): Id64Set { return this._specialElements.alwaysDrawn; } // Get the list of elements that are always drawn

    /** Following properties are only mutable internally: */
    private _defaultOverrides = new Appearance();
    private _constructions = false;
    private _dimensions = false;
    private _patterns = false;
    private _alwaysDrawnExclusive = false;
    private _lineWeights = true;

    public readonly modelOverrides = new Map<string, Appearance>();
    public readonly elementOverrides = new Map<string, Appearance>();
    public readonly subCategoryOverrides = new Map<string, Appearance>();

    public readonly visibleSubCategories = new Set<string>();

    public get defaultOverrides(): Appearance { return this._defaultOverrides; }
    public get isAlwaysDrawnExclusive(): boolean { return this._alwaysDrawnExclusive; }
    public get lineWeights(): boolean { return this._lineWeights; }

    public copyAlwaysDrawn(always: Id64Set): void { this._specialElements.setAlwaysDrawn(always); }
    public copyNeverDrawn(never: Id64Set): void { this._specialElements.setNeverDrawn(never); }

    public isNeverDrawn(id: Id64): boolean { return this._specialElements.isNeverDrawn(id); }
    public isAlwaysDrawn(id: Id64): boolean { return this._specialElements.isAlwaysDrawn(id); }
    public isSubCategoryVisible(id: Id64): boolean { return this.visibleSubCategories.has(id.value); }

    public clearModelOverrides(id: Id64): void { this.modelOverrides.delete(id.value); }
    public clearElementOverrides(id: Id64): void { this.elementOverrides.delete(id.value); }
    public clearSubCategoryOverrides(id: Id64): void { this.subCategoryOverrides.delete(id.value); }
    public clearAlwaysDrawn(id?: Id64): void { this._specialElements.clearAlwaysDrawn(id); }
    public clearNeverDrawn(id?: Id64): void { this._specialElements.clearNeverDrawn(id); }
    public clearVisibleSubCategory(id: Id64): void { this.visibleSubCategories.delete(id.value); }

    public getModelOverrides(id: Id64): Appearance | undefined { return this.modelOverrides.get(id.value); }
    public getElementOverrides(id: Id64): Appearance | undefined { return this.elementOverrides.get(id.value); }
    public getSubCategoryOverrides(id: Id64): Appearance | undefined { return this.subCategoryOverrides.get(id.value); }

    public setModelOverrides(id: Id64, app: Appearance): void { this.modelOverrides.set(id.value, app.clone()); }
    public setElementOverrides(id: Id64, app: Appearance): void { this.elementOverrides.set(id.value, app.clone()); }
    public setSubCategoryOverrides(id: Id64, app: Appearance): void { this.subCategoryOverrides.set(id.value, app.clone()); }
    public setVisibleSubCategory(id: Id64): void { this.visibleSubCategories.add(id.value); }
    public setNeverDrawn(id: Id64): void { this._specialElements.setNeverDrawn(id); }
    public setAlwaysDrawn(id: Id64): void { this._specialElements.setAlwaysDrawn(id); }
    public setAlwaysDrawnExclusive(exclusive: boolean = true): void { this._alwaysDrawnExclusive = exclusive; }
    /**
     * Returns false if the feature is invisible.
     * Otherwise, populates the feature's Appearance overrides
     */
    public getAppearance(app: Appearance, feature: Feature, id: Id64): boolean {
      const modelApp = this.getModelOverrides(id);

      if (undefined !== modelApp) app.setFrom(modelApp); // preserve ref by calling setFrom instead of assigning
      else app.reset();

      // Is the element visible?
      const { elementId, subCategoryId, geometryClass } = feature;
      let elemApp, alwaysDrawn = false;

      if (elementId.isValid()) {
        if (this.isNeverDrawn(elementId))
          return false;

        alwaysDrawn = this.isAlwaysDrawn(elementId);
        if (!alwaysDrawn && this.isAlwaysDrawnExclusive)
          return false;

        // Element overrides take precedence
        elemApp = this.getElementOverrides(elementId);
        if (undefined !== elemApp) app.setFrom(undefined !== modelApp ? elemApp.extend(app) : elemApp);
      }

      if (subCategoryId.isValid()) {
        if (!alwaysDrawn && !this.isSubCategoryVisible(subCategoryId))
          return false;

        const subCat = this.getSubCategoryOverrides(subCategoryId);
        if (undefined !== subCat) app.setFrom(subCat.extend(app));
      }

      if (undefined === elemApp && undefined === modelApp)
        app.setFrom(this._defaultOverrides.extend(app));

      let visible = alwaysDrawn || this.isClassVisible(geometryClass);
      if (visible && app.overridesAlpha) visible = app.alpha! < 0xff; // don't bother rendering something with full transparency...

      if (!this._lineWeights) app.weight = 1;

      return visible;
    }

    public isClassVisible(geomClass: GeometryClass): boolean {
      switch (geomClass) {
        case GeometryClass.Construction: return this._constructions;
        case GeometryClass.Dimension: return this._dimensions;
        case GeometryClass.Pattern: return this._patterns;
        default: return true;
      }
    }

    public isFeatureVisible(feature: Feature): boolean {
      // TFS#808986: Navigator puts some elements into both the 'never' and 'always' lists which is weird but
      // the docs for ViewController::GetNeverDrawn() assert that in that case the 'never' list wins.
      const { elementId, subCategoryId, geometryClass } = feature;
      const isValidElemId = elementId.isValid();

      if (isValidElemId && this.isNeverDrawn(elementId))
        return false;

      const alwaysDrawn = isValidElemId && this.isAlwaysDrawn(elementId);
      if (alwaysDrawn || this.isAlwaysDrawnExclusive)
        return alwaysDrawn;

      if (!this.isSubCategoryVisible(subCategoryId))
        return false;

      return this.isClassVisible(geometryClass);
    }

    // Specify overrides for all elements within the specified model. These overrides take priority.
    public overrideModel(id: Id64, app: Appearance, replaceExisting: boolean = true): void {
      if (!id.isValid())
        return;

      const model = this.getModelOverrides(id);

      if (undefined === model) this.setModelOverrides(id, app);
      else if (replaceExisting) model.setFrom(app);
    }

    public overrideSubCategory(id: Id64, app: Appearance, replaceExisting: boolean = true): void {
      if (!id.isValid() || !this.isSubCategoryVisible(id))
        return;

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this subcategory"
      const subCatApp = this.getSubCategoryOverrides(id);

      if (undefined === subCatApp) this.setSubCategoryOverrides(id, app);
      else if (replaceExisting) subCatApp.setFrom(app);
    }

    // NB: Appearance can override nothing, which prevents the default overrides from applying to it.
    public overrideElement(id: Id64, app: Appearance, replaceExisting: boolean = true): void {
      if (!id.isValid() || this.isNeverDrawn(id))
        return;

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this element"
      const elemApp = this.getElementOverrides(id);

      if (undefined === elemApp) this.setElementOverrides(id, app);
      else if (replaceExisting) elemApp.setFrom(app);
    }

    public setDefaultOverrides(appearance: Appearance, replaceExisting: boolean = true): void {
      if (replaceExisting || !appearance.overridesSymbology) this._defaultOverrides = appearance.clone();
    }

    public initFromView(view: ViewState) {
      const { alwaysDrawn, neverDrawn, viewFlags } = view;
      const { constructions, dimensions, patterns } = viewFlags;

      this.copyAlwaysDrawn(alwaysDrawn);
      this.copyNeverDrawn(neverDrawn);

      this._constructions = constructions;
      this._dimensions = dimensions;
      this._patterns = patterns;
      this._lineWeights = viewFlags.showWeights();

      for (const categoryId of view.categorySelector.categories) {
        const subCategoryIds = view.subCategories.getSubCategories(categoryId);
        if (undefined === subCategoryIds)
          continue;

        for (const subCategoryId of subCategoryIds) {
          if (view.isSubCategoryVisible(subCategoryId)) {
            this.visibleSubCategories.add(subCategoryId);
            const ovr = view.getSubCategoryOverride(subCategoryId);
            if (undefined !== ovr) {
              const app = new Appearance();
              app.initFrom(ovr);
              if (app.overridesSymbology)
                this.subCategoryOverrides.set(subCategoryId, app);
            }
          }
        }
      }
    }

    constructor(view?: ViewState) { if (undefined !== view) this.initFromView(view); }
  }
}
