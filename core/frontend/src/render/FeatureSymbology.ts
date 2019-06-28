/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { LinePixels, ColorDef, RgbColor, Feature, GeometryClass, SubCategoryOverride, BatchType } from "@bentley/imodeljs-common";
import { Id64, Id64String, Id64Set } from "@bentley/bentleyjs-core";
import { Viewport } from "../Viewport";
import { ViewState } from "../ViewState";

function copyIdSetToUint32Set(dst: Id64.Uint32Set, src?: Set<string>): void {
  dst.clear();
  if (undefined !== src) {
    for (const id of src)
      dst.addId(id);
  }
}

/** Contains types that enable an application to customize how [Feature]($common)s are drawn within a [[Viewport]].
 * @public
 */
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
    /** If true, ignore the [RenderMaterial]($common) associated with surfaces. */
    ignoresMaterial?: true | undefined;
    /** If true, the associated [Feature]($common)s will not be drawn when using [[Viewport.readPixels]]. */
    nonLocatable?: true | undefined;
  }

  /** Defines overrides for selected aspects of a [Feature]($common)'s symbology.
   * Any member defined in the Appearance overrides that aspect of symbology for all [Feature]($common)s to which the Appearance is applied.
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
    /** If true, ignore the [RenderMaterial]($common) associated with surfaces. */
    public readonly ignoresMaterial?: true | undefined;
    /** If true, ignore the [Feature]($common) when using [[Viewport.readPixels]]. */
    public readonly nonLocatable?: true | undefined;

    /** An Appearance which overrides nothing. */
    public static readonly defaults = new Appearance({});

    public static fromJSON(props?: AppearanceProps) {
      if (undefined === props || (undefined === props.rgb && undefined === props.weight && undefined === props.transparency && undefined === props.linePixels && !props.ignoresMaterial && !props.nonLocatable))
        return this.defaults;
      else
        return new Appearance(props);
    }

    /** Create an Appearance that overrides only the RGB color of a [Feature]($common).
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
    /** Create an Appearance that overrides only the transparency */
    public static fromTransparency(transparencyValue: number) { return this.fromJSON({ transparency: transparencyValue }); }

    /** Create an Appearance with overrides corresponding to those defined by the supplied SubCategoryOverride. */
    public static fromSubCategoryOverride(ovr: SubCategoryOverride): Appearance {
      const rgb = undefined !== ovr.color ? RgbColor.fromColorDef(ovr.color) : undefined;
      const transparency = undefined !== ovr.transparency ? ovr.transparency : undefined;
      const weight = undefined !== ovr.weight ? ovr.weight : undefined;
      const ignoresMaterial = undefined !== ovr.material && Id64.isValid(ovr.material) ? true : undefined;
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
        nonLocatable: this.nonLocatable ? true : undefined,
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
      if (undefined === props.nonLocatable && this.nonLocatable) props.nonLocatable = true;

      return Appearance.fromJSON(props);
    }

    private constructor(props: AppearanceProps) {
      this.rgb = props.rgb;
      this.weight = props.weight;
      this.transparency = props.transparency;
      this.linePixels = props.linePixels;
      this.ignoresMaterial = props.ignoresMaterial;
      this.nonLocatable = props.nonLocatable;

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

  /** Allows a [[Viewport]] to customize the appearance of individual [Feature]($common)s within it.
   *
   * The Viewport computes its base Overrides based on the following:
   *  - The set of categories enabled for display in its [[CategorySelectorState]]. Every [[SubCategory]] belonging to an enabled [[Category]] is added to the set of visible subcategories - all other subcategories are assumed to be invisible.
   *  - For the set of visible subcategories, any [[SubCategoryOverride]]s defined by the view's [[DisplayStyleState]] are applied. This may render some subcategories invisible, and change the symbology of others.
   *  - The visibility of each [GeometryClass]($common) is set based on the view's [[ViewFlags]].
   *  - The line weight is overridden to 1 pixel for all Features if line weight has been disabled by the view's [[ViewFlags]].
   *  - The sets of elements which are always drawn and never drawn are initialized from the [[Viewport]]'s sets.
   * An application can further customize the symbology of any Features by registering a [[FeatureOverrideProvider]] with a [[Viewport]]. That provider's addFeatureOverrides function will be invoked
   * whenever the Overrides need to be regenerated.
   *
   * To override the symbology of *most* Features within a view, specify a [[defaultOverrides]] to be applied to any Feature not explicitly overridden.
   * If default overrides are defined and some Features should draw normally without being affected by the default overrides, override that Feature with
   * an Appearance which defines no overrides.
   *
   * It is possible to override multiple aspects of a Feature. For example, you might specify that all elements belonging to subcategory "A" should be drawn in red, and
   * that the element with Id "0x123" should be drawn with 0.25 transparency. In this case, when drawing a Feature with subcategory "A" and element Id "0x123", the two overrides will
   * be merged, causing the Feature's geometry to draw 25% transparent red. On the other hand, if subcategory "A" is specified to draw in red and element "0x123" to draw in green,
   * the color specified by the element override will take precedence over that specified for the subcategory, resulting in a green Feature.
   *
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.neverDrawn]]
   */
  export class Overrides {
    /** Ids of elements which should never be drawn. This takes precedence over [[_alwaysDrawn]]. @internal */
    protected readonly _neverDrawn = new Id64.Uint32Set();
    /** Ids of elements which should always be drawn. [[_neverDrawn]] takes precedence over this set. @internal */
    protected readonly _alwaysDrawn = new Id64.Uint32Set();
    /** If true, no elements *except* those defined in the "always drawn" set will be drawn.
     * @see [[setAlwaysDrawn]]
     */
    public isAlwaysDrawnExclusive = false;

    /** Overrides applied to any feature not explicitly overridden. @internal */
    protected _defaultOverrides = Appearance.defaults;
    /** Whether construction geometry should be drawn. @internal */
    protected _constructions = false;
    /** Whether dimensions should be drawn. @internal */
    protected _dimensions = false;
    /** Whether area patterns should be drawn. @internal */
    protected _patterns = false;
    /** Whether line weights should be applied. If false, all lines are rendered 1-pixel wide. @internal */
    protected _lineWeights = true;

    /** Overrides applied to all elements belonging to each model. @internal */
    protected readonly _modelOverrides = new Id64.Uint32Map<Appearance>();
    /** Overrides applied to specific elements. @internal */
    protected readonly _elementOverrides = new Id64.Uint32Map<Appearance>();
    /** Overrides applied to geometry belonging to each subcategory. @internal */
    protected readonly _subCategoryOverrides = new Id64.Uint32Map<Appearance>();
    /** The set of displayed subcategories. Geometry belonging to subcategories not included in this set will not be drawn. @internal */
    protected readonly _visibleSubCategories = new Id64.Uint32Set();

    /** Per-model, a set of subcategories whose visibility should be inverted for elements within that model.
     * Populated by Viewport.
     * @internal
     */
    protected readonly _modelSubCategoryOverrides = new Id64.Uint32Map<Id64.Uint32Set>();

    /** Ids of animation nodes which should never be drawn.
     * @internal
     */
    public readonly neverDrawnAnimationNodes = new Set<number>();
    /** Mapping of animation node Ids to overrides applied to the corresponding animation nodes.
     * @internal
     */
    public readonly animationNodeOverrides = new Map<number, Appearance>();

    /** Overrides applied to features for which no other overrides are defined */
    public get defaultOverrides(): Appearance { return this._defaultOverrides; }
    /** Whether or not line weights are applied. If false, all lines are drawn with a weight of 1. */
    public get lineWeights(): boolean { return this._lineWeights; }

    /** @internal */
    protected isNeverDrawn(elemIdLo: number, elemIdHi: number, animationNodeId: number): boolean {
      if (this._neverDrawn.has(elemIdLo, elemIdHi))
        return true;
      else
        return 0 !== animationNodeId && this.neverDrawnAnimationNodes.has(animationNodeId);
    }
    /** @internal */
    protected isAlwaysDrawn(idLo: number, idHi: number): boolean { return this._alwaysDrawn.has(idLo, idHi); }
    /** Returns true if the [[SubCategory]] specified by Id is in the set of visible subcategories. @internal */
    public isSubCategoryVisible(idLo: number, idHi: number): boolean { return this._visibleSubCategories.has(idLo, idHi); }
    /** @internal */
    public isSubCategoryVisibleInModel(subcatLo: number, subcatHi: number, modelLo: number, modelHi: number): boolean {
      let vis = this.isSubCategoryVisible(subcatLo, subcatHi);
      const modelOvr = this._modelSubCategoryOverrides.get(modelLo, modelHi);
      if (undefined !== modelOvr && modelOvr.has(subcatLo, subcatHi))
        vis = !vis;

      return vis;
    }

    /** @internal */
    protected getModelOverrides(idLo: number, idHi: number): Appearance | undefined { return this._modelOverrides.get(idLo, idHi); }
    /** @internal */
    protected getElementOverrides(idLo: number, idHi: number, animationNodeId: number): Appearance | undefined {
      const app = this._elementOverrides.get(idLo, idHi);
      if (app !== undefined || 0 === animationNodeId)
        return app;

      return this.animationNodeOverrides.get(animationNodeId);
    }
    /** @internal */
    protected getSubCategoryOverrides(idLo: number, idHi: number): Appearance | undefined { return this._subCategoryOverrides.get(idLo, idHi); }

    /** Add a [[SubCategory]] to the set of visible subcategories. */
    public setVisibleSubCategory(id: Id64String): void { this._visibleSubCategories.addId(id); }
    /** Specify the Id of an element which should never be drawn in this view. */
    public setNeverDrawn(id: Id64String): void { this._neverDrawn.addId(id); }
    /** Specify the Id of an element which should always be drawn in this view. */
    public setAlwaysDrawn(id: Id64String): void { this._alwaysDrawn.addId(id); }
    /** Specify the Id of a animation node which should never be drawn in this view. */
    public setAnimationNodeNeverDrawn(id: number): void { this.neverDrawnAnimationNodes.add(id); }
    /** Specify the Ids of elements which should never be drawn in this view. */
    public setNeverDrawnSet(ids: Id64Set) { copyIdSetToUint32Set(this._neverDrawn, ids); }
    /** Specify the Ids of elements which should always be drawn in this view. */
    public setAlwaysDrawnSet(ids: Id64Set, exclusive: boolean) { copyIdSetToUint32Set(this._alwaysDrawn, ids); this.isAlwaysDrawnExclusive = exclusive; }

    /** Returns the feature's Appearance overrides, or undefined if the feature is not visible. */
    public getFeatureAppearance(feature: Feature, modelId: Id64String, type: BatchType = BatchType.Primary): Appearance | undefined {
      return this.getAppearance(
        Id64.getLowerUint32(feature.elementId), Id64.getUpperUint32(feature.elementId),
        Id64.getLowerUint32(feature.subCategoryId), Id64.getUpperUint32(feature.subCategoryId),
        feature.geometryClass,
        Id64.getLowerUint32(modelId), Id64.getUpperUint32(modelId),
        type, 0);
    }

    private static readonly _weight1Appearance = Appearance.fromJSON({ weight: 1 });

    /** Returns a feature's Appearance overrides, or undefined if the feature is not visible.
     * Takes Id64s as pairs of unsigned 32-bit integers, because that is how they are stored by the PackedFeatureTable associated with each batch of graphics.
     * This API is much uglier but also much more efficient.
     * @internal
     */
    public getAppearance(elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number): Appearance | undefined {
      if (BatchType.VolumeClassifier === type)
        return this.getClassifierAppearance(elemLo, elemHi, subcatLo, subcatHi, modelLo, modelHi);

      let app = !this._lineWeights ? Overrides._weight1Appearance : Appearance.defaults;
      const modelApp = this.getModelOverrides(modelLo, modelHi);
      if (undefined !== modelApp)
        app = modelApp.extendAppearance(app);

      // Is the element visible?
      let elemApp, alwaysDrawn = false;

      if (Id64.isValidUint32Pair(elemLo, elemHi)) {
        if (this.isNeverDrawn(elemLo, elemHi, animationNodeId))
          return undefined;

        alwaysDrawn = this.isAlwaysDrawn(elemLo, elemHi);
        if (!alwaysDrawn && this.isAlwaysDrawnExclusive)
          return undefined;

        // Element overrides take precedence
        elemApp = this.getElementOverrides(elemLo, elemHi, animationNodeId);
        if (undefined !== elemApp)
          app = undefined !== modelApp ? elemApp.extendAppearance(app) : elemApp;
      }

      let subCatApp;
      if (Id64.isValidUint32Pair(subcatLo, subcatHi)) {
        if (!alwaysDrawn && !this.isSubCategoryVisibleInModel(subcatLo, subcatHi, modelLo, modelHi))
          return undefined;

        subCatApp = this.getSubCategoryOverrides(subcatLo, subcatHi);
        if (undefined !== subCatApp)
          app = subCatApp.extendAppearance(app);
      }

      // Only apply default if NO Appearance was explicitly registered (doesn't matter if registered Appearance does not actually override anything)
      if (undefined === elemApp && undefined === modelApp && undefined === subCatApp)
        app = this._defaultOverrides.extendAppearance(app);

      let visible = alwaysDrawn || this.isClassVisible(geomClass);
      if (visible && app.isFullyTransparent)
        visible = false; // don't bother rendering something with full transparency...

      return visible ? app : undefined;
    }

    /** Classifiers behave totally differently...in particular they are never invisible unless fully-transparent.
     * @internal
     */
    protected getClassifierAppearance(elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, modelLo: number, modelHi: number): Appearance | undefined {
      let app = Appearance.defaults;
      const modelApp = this.getModelOverrides(modelLo, modelHi);
      if (undefined !== modelApp)
        app = modelApp.extendAppearance(app);

      const elemApp = this.getElementOverrides(elemLo, elemHi, 0);
      if (undefined !== elemApp)
        app = undefined !== modelApp ? elemApp.extendAppearance(app) : elemApp;

      if (Id64.isValidUint32Pair(subcatLo, subcatHi)) {
        const subCat = this.getSubCategoryOverrides(subcatLo, subcatHi);
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

    /** @internal */
    public isClassVisible(geomClass: GeometryClass): boolean {
      switch (geomClass) {
        case GeometryClass.Construction: return this._constructions;
        case GeometryClass.Dimension: return this._dimensions;
        case GeometryClass.Pattern: return this._patterns;
        default: return true;
      }
    }

    /** Specify overrides for all elements within the specified model.
     * @param id The Id of the model.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same model.
     * @note These overrides take priority over all other overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to any element within this model, even if the supplied Appearance overrides nothing.
     */
    public overrideModel(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      const idLo = Id64.getLowerUint32(id);
      const idHi = Id64.getUpperUint32(id);
      if (replaceExisting || undefined === this.getModelOverrides(idLo, idHi))
        this._modelOverrides.set(idLo, idHi, app);
    }

    /** Specify overrides for all geometry belonging to the specified [[SubCategory]].
     * @param id The Id of the subcategory.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same subcategory.
     * @note These overrides have lower priority than element and model overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to any geometry within this subcategory, even if the supplied Appearance overrides nothing.
     */
    public overrideSubCategory(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      // NB: We used to do nothing if this.isSubCategoryVisible() => false but now models can turn invisible subcategories visible in their own context.
      const idLo = Id64.getLowerUint32(id);
      const idHi = Id64.getUpperUint32(id);

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this subcategory"
      if (replaceExisting || undefined === this.getSubCategoryOverrides(idLo, idHi))
        this._subCategoryOverrides.set(idLo, idHi, app);
    }

    /** Specify overrides for all geometry originating from the specified element.
     * @param id The Id of the element.
     * @param app The symbology overrides.
     * @param replaceExisting Specifies whether to replace a pre-existing override for the same element.
     * @note These overrides take precedence over subcategory overrides, but not over model overrides.
     * @note If [[defaultOverrides]] are defined, they will not apply to this element, even if the supplied Appearance overrides nothing.
     */
    public overrideElement(id: Id64String, app: Appearance, replaceExisting: boolean = true): void {
      const idLo = Id64.getLowerUint32(id);
      const idHi = Id64.getUpperUint32(id);
      if (this.isNeverDrawn(idLo, idHi, 0))
        return;

      // NB: Appearance may specify no overridden symbology - this means "don't apply the default overrides to this element"
      if (replaceExisting || undefined === this.getElementOverrides(idLo, idHi, 0))
        this._elementOverrides.set(idLo, idHi, app);
    }
    /** Specify overrides for all geometry originating from the specified animation node.
     * @param id The Id of the animation node.
     * @param app The symbology overrides.
     * @note These overides do not take precedence over element overrides.
     */
    public overrideAnimationNode(id: number, app: Appearance): void { this.animationNodeOverrides.set(id, app); }

    /** Defines a default Appearance to be applied to any [Feature]($common) *not* explicitly overridden.
     * @param appearance The symbology overides.
     * @param replaceExisting Specifies whether to replace the current default overrides if they are already defined.
     */
    public setDefaultOverrides(appearance: Appearance, replaceExisting: boolean = true): void {
      if (replaceExisting || !appearance.overridesSymbology)
        this._defaultOverrides = appearance;
    }

    /** Initialize these Overrides based on a specific view.
     * @internal
     */
    public initFromView(view: ViewState): void {
      this._initFromView(view);
      this._initSubCategoryOverrides(view);
    }

    /** Initialize these Overrides based on a specific viewport.
     * @internal
     */
    public initFromViewport(viewport: Viewport): void {
      const view = viewport.view;
      this._initFromView(view);

      if (undefined !== viewport.neverDrawn)
        this.setNeverDrawnSet(viewport.neverDrawn);

      if (undefined !== viewport.alwaysDrawn)
        this.setAlwaysDrawnSet(viewport.alwaysDrawn, viewport.isAlwaysDrawnExclusive);

      if (undefined !== view.scheduleScript)
        view.scheduleScript.getSymbologyOverrides(this, viewport.scheduleTime);

      if (undefined !== viewport.featureOverrideProvider)
        viewport.featureOverrideProvider.addFeatureOverrides(this, viewport);

      viewport.addModelSubCategoryVisibilityOverrides(this, this._modelSubCategoryOverrides);

      // This will include any per-model subcategory visibility overrides added above.
      this._initSubCategoryOverrides(view);
    }

    private _initFromView(view: ViewState): void {
      const { viewFlags } = view;
      const { constructions, dimensions, patterns } = viewFlags;

      this.neverDrawnAnimationNodes.clear();
      this.animationNodeOverrides.clear();

      const excludedElements = view.displayStyle.settings.excludedElements;
      excludedElements.forEach((element: Id64String) => {
        this.setNeverDrawn(element);
      });

      this._constructions = constructions;
      this._dimensions = dimensions;
      this._patterns = patterns;
      this._lineWeights = viewFlags.weights;

      for (const categoryId of view.categorySelector.categories) {
        const subCategoryIds = view.iModel.subcategories.getSubCategories(categoryId);
        if (undefined === subCategoryIds)
          continue;

        for (const subCategoryId of subCategoryIds) {
          if (view.isSubCategoryVisible(subCategoryId)) {
            const idLo = Id64.getLowerUint32(subCategoryId);
            const idHi = Id64.getUpperUint32(subCategoryId);
            this._visibleSubCategories.add(idLo, idHi);
          }
        }
      }
    }

    private _initSubCategoryOverrides(view: ViewState): void {
      const addOverride = (idLo: number, idHi: number) => {
        const subCategoryId = Id64.fromUint32Pair(idLo, idHi);
        const ovr = view.getSubCategoryOverride(subCategoryId);
        if (undefined !== ovr) {
          const app = Appearance.fromSubCategoryOverride(ovr);
          if (app.overridesSymbology)
            this._subCategoryOverrides.set(idLo, idHi, app);
        }
      };

      // Add overrides for all subcategories visible in the view
      this._visibleSubCategories.forEach((idLo: number, idHi: number) => {
        addOverride(idLo, idHi);
      });

      // Add overrides for all subcategories overridden to be visible in specific models
      this._modelSubCategoryOverrides.forEach((_modelIdLo: number, _modelIdHi: number, subcats: Id64.Uint32Set) => {
        subcats.forEach((idLo: number, idHi: number) => {
          if (!this.isSubCategoryVisible(idLo, idHi)) {
            // Overridden to be visible in one or more models - will need the appearance overrides
            addOverride(idLo, idHi);
          }
        });
      });
    }

    /** Construct a new Overrides. The result is an empty set of overrides if no view or viewport is supplied.
     * @param view If supplied, the overrides will be initialized based on the current state of the view or viewport.
     */
    public constructor(view?: ViewState | Viewport) {
      if (undefined !== view) {
        if (view instanceof Viewport)
          this.initFromViewport(view);
        else
          this.initFromView(view);
      }
    }

    /** Returns true if geometry belonging to the specified subcategory will be drawn. */
    public isSubCategoryIdVisible(id: Id64String): boolean { return this.isSubCategoryVisible(Id64.getLowerUint32(id), Id64.getUpperUint32(id)); }
    /** Returns the overrides applied to geometry belonging to the specified model, if any such are defined. */
    public getModelOverridesById(id: Id64String): Appearance | undefined { return this.getModelOverrides(Id64.getLowerUint32(id), Id64.getUpperUint32(id)); }
    /** Returns the overrides applied to geometry belonging to the specified element, if any such are defined. */
    public getElementOverridesById(id: Id64String): Appearance | undefined { return this.getElementOverrides(Id64.getLowerUint32(id), Id64.getUpperUint32(id), 0); }
    /** Returns the overrides applied to geometry belonging to the specified subcategory, if any such are defined. */
    public getSubCategoryOverridesById(id: Id64String): Appearance | undefined { return this.getSubCategoryOverrides(Id64.getLowerUint32(id), Id64.getUpperUint32(id)); }

    /** Returns true if the specified Feature will be drawn. */
    public isFeatureVisible(feature: Feature): boolean {
      const { elementId, subCategoryId, geometryClass } = feature;
      const isValidElemId = !Id64.isInvalid(elementId);
      const elemIdParts = isValidElemId ? Id64.getUint32Pair(elementId) : undefined;

      if (undefined !== elemIdParts && this.isNeverDrawn(elemIdParts.lower, elemIdParts.upper, 0))
        return false;

      const alwaysDrawn = undefined !== elemIdParts && this.isAlwaysDrawn(elemIdParts.lower, elemIdParts.upper);
      if (alwaysDrawn || this.isAlwaysDrawnExclusive)
        return alwaysDrawn;

      // NB: This ignores per-model subcategory visibility overrides, because caller did not specify a model.
      if (!this.isSubCategoryIdVisible(subCategoryId))
        return false;

      return this.isClassVisible(geometryClass);
    }
  }
}
