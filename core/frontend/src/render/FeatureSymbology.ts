/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { LinePixels, ColorDef, RgbColor, Feature, GeometryClass, SubCategoryOverride, BatchType } from "@bentley/imodeljs-common";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { ViewState } from "../ViewState";

/** Contains types that enable an application to customize how [[Feature]]s are drawn within a [[Viewport]]. */
export namespace FeatureSymbology {
  /** Properties used to initialize a [[FeatureSymbology.Appearance]]. */
  export interface AppearanceProps {
    /** The color of the Appearance */
    rgb?: RgbColor;
    /** The line weight of the Appearance */
    weight?: number;
    /** The transparency in the range [0.0, 1.0] where 0 indicates fully opaque and 1 indicates fully transparent. */
    transparency?: number;
    /** The pixel pattern used to draw lines. */
    linePixels?: LinePixels;
    /** If true, ignore the [[RenderMaterial]] associated with surfaces. */
    ignoresMaterial?: true | undefined;
  }

  /** Defines overrides for selected aspects of a [[Feature]]'s symbology.
   * Any member defined in the Appearance overrides that aspect of symbology for all [[Feature]]s to which the Appearance is applied.
   * @see [[FeatureSymbology.Overrides]]
   */
  export class Appearance implements AppearanceProps {
    /** The rgb color. */
    public readonly rgb?: RgbColor;
    /** The line width, in pixels. */
    public readonly weight?: number;
    /** The transparency in the range [0.0, 1.0] where 0 indicates fully opaque and 1 indicates fully transparent. */
    public readonly transparency?: number;
    /** The pixel pattern used to draw lines. */
    public readonly linePixels?: LinePixels;
    /** If true, ignore the [[RenderMaterial]] associated with surfaces. */
    public readonly ignoresMaterial?: true | undefined;

    /** An Appearance which overrides nothing. */
    public static readonly defaults = new Appearance({});

    public static fromJSON(props?: AppearanceProps) {
      if (undefined === props || (undefined === props.rgb && undefined === props.weight && undefined === props.transparency && undefined === props.linePixels && !props.ignoresMaterial))
        return this.defaults;
      else
        return new Appearance(props);
    }

    /** Create an Appearance that overrides only the RGB color of a [[Feature]].
     * @note The transparency component of the ColorDef is ignored.
     */
    public static fromRgb(color: ColorDef): Appearance { return this.fromJSON({ rgb: RgbColor.fromColorDef(color) }); }

    /** Create an Appearance that overrides the RGB and transparency of a Feature.
     * The Appearance's transparency is derived from the transparency component of the ColorDef.
     */
    public static fromRgba(color: ColorDef): Appearance {
      return this.fromJSON({
        rgb: RgbColor.fromColorDef(color),
        transparency: color.colors.t / 255,
      });
    }

    /** Create an Appearance with overrides corresponding to those defined by the supplied SubCategoryOverride. */
    public static fromSubCategoryOverride(ovr: SubCategoryOverride): Appearance {
      const rgb = undefined !== ovr.color ? RgbColor.fromColorDef(ovr.color) : undefined;
      const transparency = undefined !== ovr.transparency ? ovr.transparency : undefined;
      const weight = undefined !== ovr.weight ? ovr.weight : undefined;
      const ignoresMaterial = undefined !== ovr.material && !ovr.material.isValid ? true : undefined;
      return this.fromJSON({ rgb, transparency, weight, ignoresMaterial });
    }

    public get overridesRgb(): boolean { return undefined !== this.rgb; }
    public get overridesTransparency(): boolean { return undefined !== this.transparency; }
    public get overridesLinePixels(): boolean { return undefined !== this.linePixels; }
    public get overridesWeight(): boolean { return undefined !== this.weight; }
    public get overridesSymbology(): boolean { return this.overridesRgb || this.overridesTransparency || this.overridesWeight || this.overridesLinePixels || !!this.ignoresMaterial; }
    public get isFullyTransparent(): boolean { return undefined !== this.transparency && this.transparency >= 1.0; }

    public equals(other: Appearance): boolean {
      return this.rgbIsEqual(other.rgb) && this.weight === other.weight && this.transparency === other.transparency && this.linePixels === other.linePixels && this.ignoresMaterial === other.ignoresMaterial;
    }

    public toJSON(): AppearanceProps {
      return {
        rgb: this.rgb,
        weight: this.weight,
        transparency: this.transparency,
        linePixels: this.linePixels,
        ignoresMaterial: this.ignoresMaterial ? true : undefined,
      };
    }

    /** Produce an Appearance from the supplied Appearance in which any aspect not defined by the base Appearance is overridden by this Appearance. */
    public extendAppearance(base: Appearance): Appearance {
      if (!this.overridesSymbology)
        return base;

      const props = base.toJSON();
      if (undefined === props.rgb) props.rgb = this.rgb;
      if (undefined === props.transparency) props.transparency = this.transparency;
      if (undefined === props.linePixels) props.linePixels = this.linePixels;
      if (undefined === props.weight) props.weight = this.weight;
      if (undefined === props.ignoresMaterial && this.ignoresMaterial) props.ignoresMaterial = true;

      return Appearance.fromJSON(props);
    }

    private constructor(props: AppearanceProps) {
      this.rgb = props.rgb;
      this.weight = props.weight;
      this.transparency = props.transparency;
      this.linePixels = props.linePixels;
      this.ignoresMaterial = props.ignoresMaterial;

      if (undefined !== this.weight)
        this.weight = Math.max(1, Math.min(this.weight, 32));

      if (undefined !== this.transparency) {
        this.transparency = Math.max(0, Math.min(this.transparency, 1));

        // Fix up rounding errors...
        const smallDelta = 0.0001;
        if (1.0 - this.transparency < smallDelta)
          this.transparency = 1.0;
        else if (this.transparency < smallDelta)
          this.transparency = 0.0;
      }
    }

    private rgbIsEqual(rgb?: RgbColor): boolean { return undefined === this.rgb ? undefined === rgb ? true : false : undefined === rgb ? false : this.rgb.equals(rgb); }
  }

  /** Allows a [[ViewState]] to customize the appearance of individual [[Feature]]s within it.
   *
   * The ViewState computes its base Overrides based on the following:
   *  - The set of categories enabled for display in its [[CategorySelectorState]]. Every [[SubCategory]] belonging to an enabled [[Category]] is added to the set of visible subcategories - all other subcategories are assumed to be invisible.
   *  - For the set of visible subcategories, any [[SubCategoryOverride]]s defined by the view's [[DisplayStyleState]] are applied. This may render some subcategories invisible, and change the symbology of others.
   *  - The visibility of each [[GeometryClass]] is set based on the view's [[ViewFlags]].
   *  - The line weight is overridden to 1 pixel for all Features if line weight has been disabled by the view's [[ViewFlags]].
   *  - The sets of elements which are always drawn and never drawn are initialized from the [[ViewState]]'s sets.
   * An application can further customize the symbology of any Features by specifying an [[AddFeatureOverrides]] function on a [[Viewport]]. That function will be invoked
   * whenever the Overrides need to be regenerated.
   *
   * To override the symbology of *most* Features within a view, specify a [[defaultOverrides]] to be applied to any Feature not explicitly overridden.
   * If default overrides are defined and some Features should draw normally without being affected by the default overrides, override that Feature with
   * an Appearance which defines no overrides.
   *
   * It is possible to override multiple aspects of a Feature. For example, you might specify that all elements belonging to subcategory "A" should be drawn in red, and
   * that the element with ID "0x123" should be drawn with 0.25 transparency. In this case, when drawing a Feature with subcategory "A" and element ID "0x123", the two overrides will
   * be merged, causing the Feature's geometry to draw 25% transparent red. On the other hand, if subcategory "A" is specified to draw in red and element "0x123" to draw in green,
   * the color specified by the element override will take precedence over that specified for the subcategory, resulting in a green Feature.
   *
   * @see [[ViewState.setFeatureOverridesDirty]] for explicitly regenerating a view's Overrides.
   * @see [[ViewState.alwaysDrawn]]
   * @see [[ViewState.neverDrawn]]
   */
  export class Overrides {
    /** The IDs of elements which should never be drawn */
    public readonly neverDrawn = new Set<string>();
    /** The IDs of elements which should always be drawn. If an element ID is present in both neverDrawn and alwaysDrawn, it is never drawn. */
    public readonly alwaysDrawn = new Set<string>();
    /** If true, no elements except those included in the alwaysDrawn set will be drawn */
    public isAlwaysDrawnExclusive: boolean = false;

    private _defaultOverrides = Appearance.defaults;
    private _constructions = false;
    private _dimensions = false;
    private _patterns = false;
    private _lineWeights = true;

    /** Mapping of model IDs to overrides applied to all elements within the corresponding model */
    public readonly modelOverrides = new Map<string, Appearance>();
    /** Mapping of element IDs to overrides applied to the corresponding element */
    public readonly elementOverrides = new Map<string, Appearance>();
    /** Mapping of subcategory IDs to overrides applied to geometry belonging to the corresponding subcategory */
    public readonly subCategoryOverrides = new Map<string, Appearance>();
    /** Set of IDs of visible subcategories. Geometry belonging to other subcategories will not be drawn */
    public readonly visibleSubCategories = new Set<string>();

    /** Overrides applied to features for which no other overrides are defined */
    public get defaultOverrides(): Appearance { return this._defaultOverrides; }
    /** Whether or not line weights are applied. If false, all lines are drawn with a weight of 1. */
    public get lineWeights(): boolean { return this._lineWeights; }

    /** @hidden */
    public isNeverDrawn(id: Id64String): boolean { return this.neverDrawn.has(id.toString()); }
    /** @hidden */
    public isAlwaysDrawn(id: Id64String): boolean { return this.alwaysDrawn.has(id.toString()); }
    /** Returns true if the [[SubCategory]] specified by ID is in the set of visible subcategories. */
    public isSubCategoryVisible(id: Id64String): boolean { return this.visibleSubCategories.has(id.toString()); }

    /** Remove any overrides for elements belonging to a model specified by ID. */
    public clearModelOverrides(id: Id64String): void { this.modelOverrides.delete(id.toString()); }
    /** Remove any overrides applied to an element specified by ID. */
    public clearElementOverrides(id: Id64String): void { this.elementOverrides.delete(id.toString()); }
    /** Remove any overrides applied to a [[SubCategory]] specified by ID. */
    public clearSubCategoryOverrides(id: Id64String): void { this.subCategoryOverrides.delete(id.toString()); }

    /** @hidden */
    public getModelOverrides(id: Id64String): Appearance | undefined { return this.modelOverrides.get(id.toString()); }
    /** @hidden */
    public getElementOverrides(id: Id64String): Appearance | undefined { return this.elementOverrides.get(id.toString()); }
    /** @hidden */
    public getSubCategoryOverrides(id: Id64String): Appearance | undefined { return this.subCategoryOverrides.get(id.toString()); }

    /** Add a [[SubCategory]] to the set of visible subcategories. */
    public setVisibleSubCategory(id: Id64String): void { this.visibleSubCategories.add(id.toString()); }
    /** Specify the ID of an element which should never be drawn in this view. */
    public setNeverDrawn(id: Id64String): void { this.neverDrawn.add(id.toString()); }
    /** Specify the ID of an element which should always be drawn in this view. */
    public setAlwaysDrawn(id: Id64String): void { this.alwaysDrawn.add(id.toString()); }

    /** Returns the feature's Appearance overrides, or undefined if the feature is not visible. */
    public getAppearance(feature: Feature, modelId: Id64String, type: BatchType = BatchType.Primary): Appearance | undefined {
      if (BatchType.Classifier === type)
        return this.getClassifierAppearance(feature, modelId);

      let app = !this._lineWeights ? Appearance.fromJSON({ weight: 1 }) : Appearance.defaults;
      const modelApp = this.getModelOverrides(modelId);
      if (undefined !== modelApp)
        app = modelApp.extendAppearance(app);

      // Is the element visible?
      const { elementId, subCategoryId, geometryClass } = feature;
      let elemApp, alwaysDrawn = false;

      if (!Id64.isInvalidId(elementId)) {
        if (this.isNeverDrawn(elementId))
          return undefined;

        alwaysDrawn = this.isAlwaysDrawn(elementId);
        if (!alwaysDrawn && this.isAlwaysDrawnExclusive)
          return undefined;

        // Element overrides take precedence
        elemApp = this.getElementOverrides(elementId);
        if (undefined !== elemApp)
          app = undefined !== modelApp ? elemApp.extendAppearance(app) : elemApp;
      }

      if (!Id64.isInvalidId(subCategoryId)) {
        if (!alwaysDrawn && !this.isSubCategoryVisible(subCategoryId))
          return undefined;

        const subCat = this.getSubCategoryOverrides(subCategoryId);
        if (undefined !== subCat)
          app = subCat.extendAppearance(app);
      }

      if (undefined === elemApp && undefined === modelApp)
        app = this._defaultOverrides.extendAppearance(app);

      let visible = alwaysDrawn || this.isClassVisible(geometryClass);
      if (visible && app.isFullyTransparent)
        visible = false; // don't bother rendering something with full transparency...

      return visible ? app : undefined;
    }

    /** Classifiers behave totally differently...in particular they are never invisible unless fully-transparent. */
    private getClassifierAppearance(feature: Feature, modelId: Id64String): Appearance | undefined {
      let app = Appearance.defaults;
      const modelApp = this.getModelOverrides(modelId);
      if (undefined !== modelApp)
        app = modelApp.extendAppearance(app);

      const { elementId, subCategoryId } = feature;
      const elemApp = this.getElementOverrides(elementId);
      if (undefined !== elemApp)
        app = undefined !== modelApp ? elemApp.extendAppearance(app) : elemApp;

      if (!Id64.isInvalidId(subCategoryId)) {
        const subCat = this.getSubCategoryOverrides(subCategoryId);
        if (undefined !== subCat)
          app = subCat.extendAppearance(app);
      }

      if (undefined === elemApp && undefined === modelApp)
        app = this._defaultOverrides.extendAppearance(app);

      if (app.isFullyTransparent)
        return undefined;
      else
        return app;
    }

    /** @hidden */
    public isClassVisible(geomClass: GeometryClass): boolean {
      switch (geomClass) {
        case GeometryClass.Construction: return this._constructions;
        case GeometryClass.Dimension: return this._dimensions;
        case GeometryClass.Pattern: return this._patterns;
        default: return true;
      }
    }

    /** Returns true if the specified Feature is visible within a [[ViewState]] to which these Overrides are applied. */
    public isFeatureVisible(feature: Feature): boolean {
      const { elementId, subCategoryId, geometryClass } = feature;
      const isValidElemId = !Id64.isInvalidId(elementId);

      if (isValidElemId && this.isNeverDrawn(elementId))
        return false;

      const alwaysDrawn = isValidElemId && this.isAlwaysDrawn(elementId);
      if (alwaysDrawn || this.isAlwaysDrawnExclusive)
        return alwaysDrawn;

      if (!this.isSubCategoryVisible(subCategoryId))
        return false;

      return this.isClassVisible(geometryClass);
    }

    /** Specify overrides for all elements within the specified model.
     * @param id The ID of the model.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same model.
     * @note These overrides take priority over all other overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to any element within this model, even if the supplied Appearance overrides nothing.
     */
    public overrideModel(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      if (replaceExisting || undefined === this.getModelOverrides(id))
        this.modelOverrides.set(id.toString(), app);
    }

    /** Specify overrides for all geometry belonging to the specified [[SubCategory]].
     * @param id The ID of the subcategory.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same subcategory.
     * @note These overrides have lower priority than element and model overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to any geometry within this subcategory, even if the supplied Appearance overrides nothing.
     */
    public overrideSubCategory(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      if (!this.isSubCategoryVisible(id))
        return;

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this subcategory"
      if (replaceExisting || undefined === this.getSubCategoryOverrides(id))
        this.subCategoryOverrides.set(id.toString(), app);
    }

    /** Specify overrides for all geometry originating from the specified element.
     * @param id The ID of the element.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same element.
     * @note These overrides take precedence over subcategory overrides, but not over model overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to this element, even if the supplied Appearance overrides nothing.
     */
    public overrideElement(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      if (this.isNeverDrawn(id))
        return;

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this element"
      if (replaceExisting || undefined === this.getElementOverrides(id))
        this.elementOverrides.set(id.toString(), app);
    }

    /** Defines a default Appearance to be applied to any [[Feature]] *not* explicitly overridden.
     * @param appearance The symbology overides.
     * @param replaceExisting Specifies whether to replace the current default overrides if they are already defined.
     */
    public setDefaultOverrides(appearance: Appearance, replaceExisting: boolean = true): void {
      if (replaceExisting || !appearance.overridesSymbology)
        this._defaultOverrides = appearance;
    }

    /** Initialize these Overrides based on the [[ViewState]]'s settings.
     * @hidden
     */
    public initFromView(view: ViewState) {
      const { alwaysDrawn, neverDrawn, viewFlags } = view;
      const { constructions, dimensions, patterns } = viewFlags;

      this.copy(this.alwaysDrawn, alwaysDrawn);
      this.copy(this.neverDrawn, neverDrawn);

      this.isAlwaysDrawnExclusive = view.isAlwaysDrawnExclusive;
      this._constructions = constructions;
      this._dimensions = dimensions;
      this._patterns = patterns;
      this._lineWeights = viewFlags.weights;

      for (const categoryId of view.categorySelector.categories) {
        const subCategoryIds = view.subCategories.getSubCategories(categoryId);
        if (undefined === subCategoryIds)
          continue;

        for (const subCategoryId of subCategoryIds) {
          if (view.isSubCategoryVisible(subCategoryId)) {
            this.visibleSubCategories.add(subCategoryId);
            const ovr = view.getSubCategoryOverride(subCategoryId);
            if (undefined !== ovr) {
              const app = Appearance.fromSubCategoryOverride(ovr);
              if (app.overridesSymbology)
                this.subCategoryOverrides.set(subCategoryId, app);
            }
          }
        }
      }
    }

    /** Create an Overrides based on the supplied [[ViewState]]. */
    constructor(view?: ViewState) { if (undefined !== view) this.initFromView(view); }

    private copy(dst: Set<string>, src?: Set<string>): void {
      dst.clear();
      if (undefined !== src) {
        for (const id of src)
          dst.add(id);
      }
    }
  }
}
