/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

// cspell:ignore greyscale ovrs

import {
  assert, BeEvent, CompressedId64Set, Id64, Id64Array, Id64String, JsonUtils, MutableCompressedId64Set, ObservableSet, OrderedId64Iterable,
} from "@bentley/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core";
import { AmbientOcclusion } from "./AmbientOcclusion";
import { AnalysisStyle, AnalysisStyleProps } from "./AnalysisStyle";
import { BackgroundMapProps, BackgroundMapSettings } from "./BackgroundMapSettings";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { DefinitionElementProps } from "./ElementProps";
import { GroundPlaneProps } from "./GroundPlane";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps, SubCategoryOverride } from "./imodeljs-common";
import { LightSettings, LightSettingsProps } from "./LightSettings";
import { MapImageryProps, MapImagerySettings } from "./MapImagerySettings";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "./PlanProjectionSettings";
import { RenderSchedule } from "./RenderSchedule";
import { SkyBoxProps } from "./SkyBox";
import { SolarShadowSettings, SolarShadowSettingsProps } from "./SolarShadows";
import { SpatialClassificationProps } from "./SpatialClassificationProps";
import { SubCategoryAppearance } from "./SubCategoryAppearance";
import { ThematicDisplay, ThematicDisplayMode, ThematicDisplayProps } from "./ThematicDisplay";
import { ViewFlagProps, ViewFlags } from "./ViewFlags";
import { ClipStyle, ClipStyleProps } from "./ClipStyle";

/** Describes the [[SubCategoryOverride]]s applied to a [[SubCategory]] by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  /** The Id of the [[SubCategory]] whose appearance is to be overridden. */
  subCategory?: Id64String;
}

/** Describes the [[FeatureAppearance]] overrides applied to a model by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @beta
 */
export interface DisplayStyleModelAppearanceProps extends FeatureAppearanceProps {
  /** The Id of the model whose appearance is to be overridden. */
  modelId?: Id64String;
}

/** JSON representation of the environment setup of a [[DisplayStyle3d]].
 * @public
 */
export interface EnvironmentProps {
  ground?: GroundPlaneProps;
  sky?: SkyBoxProps;
}
/** JSON representation of the blob properties for an OrbitGt property cloud.
 * @alpha
 */
export interface OrbitGtBlobProps {
  containerName: string;
  blobFileName: string;
  sasToken: string;
  accountName: string;
}

/** JSON representation of a context reality model
 * A context reality model is one that is not directly attached to the iModel but is instead included in the display style to
 * provide context only when that display style is applied.
 * @public
 */
export interface ContextRealityModelProps {
  tilesetUrl: string;
  /** @alpha */
  orbitGtBlob?: OrbitGtBlobProps;
  /** Not required to be present to display the model. It is use to elide the call to getRealityDataIdFromUrl in the widget if present. */
  realityDataId?: string;
  name?: string;
  description?: string;
  /** @beta */
  classifiers?: SpatialClassificationProps.Properties[];
  /** Appearance overrides.  Only the color, transparency, emphasized and nonLocatable properties are applicable.
   * @beta
   *
   */
  appearanceOverrides?: FeatureAppearanceProps;
}

/** Describes the style in which monochrome color is applied by a [[DisplayStyleSettings]].
 * @public
 */
export enum MonochromeMode {
  /** The color of the geometry is replaced with the monochrome color. e.g., if monochrome color is white, the geometry will be white. */
  Flat = 0,
  /** The color of surfaces is computed as normal, then scaled to a shade of the monochrome color based on the surface color's intensity.
   * For example, if the monochrome color is white, this results in a greyscale effect.
   * Geometry other than surfaces is treated the same as [[MonochromeMode.Flat]].
   */
  Scaled = 1,
}

/** JSON representation of the settings associated with a [[DisplayStyleProps]].
 * These settings are not stored directly as members of the [[DisplayStyleProps]]. Instead, they are stored
 * as members of `jsonProperties.styles`.
 * @see [[DisplayStyleSettings]].
 * @public
 */
export interface DisplayStyleSettingsProps {
  viewflags?: ViewFlagProps;
  /** The color displayed in the view background. Defaults to black. */
  backgroundColor?: ColorDefProps;
  /** The color used in monochrome mode. Defaults to white.
   * The monochrome color is applied to all surfaces and linear geometry.
   * It is never applied to the **edges** of surfaces, except in Wireframe render mode.
   */
  monochromeColor?: ColorDefProps;
  /** The style in which the monochrome color is applied. Default: [[MonochromeMode.Scaled]]. */
  monochromeMode?: MonochromeMode;
  /** Settings controlling display of analytical models.
   * @alpha
   */
  analysisStyle?: AnalysisStyleProps;
  /** A floating point value in [0..1] representing the animation state of this style's [[analysisStyle]]. Default: 0.0.
   * @alpha
   */
  analysisFraction?: number;
  /** Schedule script
   * @note For a [DisplayStyleState]($frontend) obtained via [IModelConnection.Views.load]($frontend), the element Ids will be omitted from all
   * of the script's [[ElementTimelineProps]] to conserve bandwidth and memory - they are not needed for display on the frontend.
   * @beta
   */
  scheduleScript?: RenderSchedule.ModelTimelineProps[];
  /** The point in time reflected by the view, in UNIX seconds.
   * This identifies a point on the timeline of the [[scheduleScript]], if any; it may also affect display of four-dimensional reality models.
   * @beta
   */
  timePoint?: number;
  /** Overrides applied to the appearances of subcategories in the view. */
  subCategoryOvr?: DisplayStyleSubCategoryProps[];

  /** Settings controlling display of map within views of geolocated models. */
  backgroundMap?: BackgroundMapProps;
  /** Contextual Reality Models */
  contextRealityModels?: ContextRealityModelProps[];
  /** Ids of elements not to be displayed in the view. Prefer the compressed format, especially when sending between frontend and backend - the number of Ids may be quite large. */
  excludedElements?: Id64Array | CompressedId64Set;
  /** Map Imagery.
   * @alpha
   */
  mapImagery?: MapImageryProps;
  /** Overrides applied to the appearance of models in the view.
   * @beta
   */
  modelOvr?: DisplayStyleModelAppearanceProps[];
  /** Style applied by the view's [ClipVector]($geometry-core).
   * @beta
   */
  clipStyle?: ClipStyleProps;
}

/** JSON representation of settings associated with a [[DisplayStyle3dProps]].
 * @see [[DisplayStyle3dSettings]].
 * @public
 */
export interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  /** Settings controlling display of skybox and ground plane. */
  environment?: EnvironmentProps;
  /** Settings controlling thematic display.
   * @beta
   */
  thematic?: ThematicDisplayProps;
  /** Settings controlling display of visible and hidden edges. */
  hline?: HiddenLine.SettingsProps;
  /** Settings controlling display of ambient occlusion, stored in Props. */
  ao?: AmbientOcclusion.Props;
  /** Settings controlling display of solar shadows, stored in Props. */
  solarShadows?: SolarShadowSettingsProps;
  /** Settings controlling how the scene is lit. */
  lights?: LightSettingsProps;
  /** Settings controlling how plan projection models are to be rendered. The key for each entry is the Id of the model to which the settings apply.
   * @beta
   */
  planProjections?: { [modelId: string]: PlanProjectionSettingsProps };
  /** Old lighting settings - only `sunDir` was ever used; it is now part of `lights`.
   * @deprecated
   * @internal
   */
  sceneLights?: { sunDir?: XYZProps };
}

/** JSON representation of a [[DisplayStyle]] or [[DisplayStyleState]].
 * @public
 */
export interface DisplayStyleProps extends DefinitionElementProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyleSettingsProps;
  };
}

/** JSON representation of a [[DisplayStyle3d]] or [[DisplayStyle3dState]].
 * @public
 */
export interface DisplayStyle3dProps extends DisplayStyleProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyle3dSettingsProps;
  };
}

/** Controls which settings are serialized by [[DisplayStyleSettings.toOverrides]]. A display style includes some settings that are specific to a given iModel - for example,
 * the subcategory overrides are indexed by subcategory Ids and model appearance overrides are indexed by model ids. Other settings are specific to a given project, like the set of displayed context reality models. Such settings can be useful
 * when creating display style overrides intended for use with a specific iModel or project, but should be omitted when creating general-purpose display style overrides intended
 * for use with any iModel or project. This is the default behavior if no more specific options are provided.
 * @beta
 */
export interface DisplayStyleOverridesOptions {
  /** Serialize all settings. Applying the resultant [[DisplayStyleSettingsProps]] will produce a [[DisplayStyleSettings]] identical to the original settings. */
  includeAll?: true;
  /** Serialize iModel-specific settings. These settings are only meaningful within the context of a specific iModel. Setting this to `true` implies all project-specific settings will be serialized too.
   * The following are iModel-specific settings:
   *  * Subcategory overrides.
   *  * Model Appearance overrides.
   *  * Classifiers associated with context reality models.
   *  * Analysis style.
   *  * Schedule script.
   *  * Excluded elements.
   *  * Plan projection settings.
   *  * Thematic sensor settings and height range. If iModel-specific settings are *not* serialized, sensors will be omitted and, for thematic height mode, the range will be omitted.
   *    * If the display style settings are associated with a [DisplayStyleState]($frontend), then overriding thematic settings will compute a default height range based on the iModel's project extents.
   */
  includeIModelSpecific?: true;
  /** Serialize project-specific settings. These settings are only meaningful within the context of a specific project. These settings are always included if `includeIModelSpecific` is `true`.
   * The following are project-specific settings:
   *  * Context reality models. If iModel-specific settings are *not* serialized, the classifiers will be omitted.
   *  * Time point.
   */
  includeProjectSpecific?: true;
  /** Serialize settings related to drawing aid decorations (the ACS triad and the grid). */
  includeDrawingAids?: true;
  /** Serialize the background map settings. */
  includeBackgroundMap?: true;
}

/** DisplayStyleSettings initially persisted its excluded elements as an array of Id64Strings in JSON, and exposed them as a Set<string>.
 * This becomes problematic when these arrays become very large, in terms of the amount of data and the time required to convert them to a Set.
 * The Ids are now persisted to JSON as a [[CompressedId64Set]], significantly reducing their size. However, for backwards API compatibility we must
 * continue to expose [[DisplayStyleSettings.excludedElements]] as a Set<string>. The [[ExcludedElements]] class tries to minimize the impact of that requirement by
 * maintaining the Ids primarily as a [[MutableCompressedId64Set]], only allocating the Set<string> if a caller actually requests it.
 * The only operation Set provides more efficiently than MutableCompressedId64Set is checking for the presence of an Id (the `has()` method).
 * @internal
 */
class ExcludedElements implements OrderedId64Iterable {
  private readonly _json: DisplayStyleSettingsProps;
  private readonly _ids: MutableCompressedId64Set;
  private _set?: ObservableSet<Id64String>;
  private _synchronizing = false;

  public constructor(json: DisplayStyleSettingsProps) {
    this._json = json;
    if (Array.isArray(json.excludedElements))
      this._ids = new MutableCompressedId64Set(CompressedId64Set.compressIds(OrderedId64Iterable.sortArray(json.excludedElements)));
    else
      this._ids = new MutableCompressedId64Set(json.excludedElements);
  }

  public reset(ids: CompressedId64Set | OrderedId64Iterable | undefined) {
    this.synchronize(() => {
      this._set?.clear();
      this._ids.reset((ids && "string" !== typeof ids) ? CompressedId64Set.compressIds(ids) : ids);
    });
  }

  public get ids(): CompressedId64Set {
    return this._ids.ids;
  }

  public add(ids: Iterable<Id64String>): void {
    this.synchronize(() => {
      for (const id of ids) {
        this._ids.add(id);
        this._set?.add(id);
      }
    });
  }

  public delete(ids: Iterable<Id64String>): void {
    this.synchronize(() => {
      for (const id of ids) {
        this._ids.delete(id);
        this._set?.delete(id);
      }
    });
  }

  public obtainSet(): Set<Id64String> {
    if (this._set)
      return this._set;

    this.synchronize(() => {
      this._set = new ObservableSet<string>(this._ids);
      this._set.onAdded.addListener((id) => this.onAdded(id));
      this._set.onDeleted.addListener((id) => this.onDeleted(id));
      this._set.onCleared.addListener(() => this.onCleared());
    });

    assert(undefined !== this._set);
    return this._set;
  }

  public [Symbol.iterator]() {
    return this._ids[Symbol.iterator]();
  }

  private onAdded(id: Id64String): void {
    this.synchronize(() => this._ids.add(id));
  }

  private onDeleted(id: Id64String): void {
    this.synchronize(() => this._ids.delete(id));
  }

  private onCleared(): void {
    this.synchronize(() => this._ids.clear());
  }

  /** The JSON must be kept up-to-date at all times. */
  private synchronize(func: () => void): void {
    if (this._synchronizing)
      return;

    this._synchronizing = true;
    try {
      func();
    } finally {
      this._synchronizing = false;

      const ids = this._ids.ids;
      if (0 === ids.length)
        delete this._json.excludedElements;
      else
        this._json.excludedElements = ids;
    }
  }
}

/** Provides access to the settings defined by a [[DisplayStyle]] or [[DisplayStyleState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @public
 */
export class DisplayStyleSettings {
  protected readonly _json: DisplayStyleSettingsProps;
  private readonly _viewFlags: ViewFlags;
  private _background: ColorDef;
  private _monochrome: ColorDef;
  private _monochromeMode: MonochromeMode;
  private readonly _subCategoryOverrides: Map<Id64String, SubCategoryOverride> = new Map<Id64String, SubCategoryOverride>();
  private readonly _modelAppearanceOverrides: Map<Id64String, FeatureAppearance> = new Map<Id64String, FeatureAppearance>();
  private readonly _excludedElements: ExcludedElements;
  private _backgroundMap: BackgroundMapSettings;
  private _mapImagery: MapImagerySettings;
  private _analysisStyle?: AnalysisStyle;
  private _clipStyle: ClipStyle;

  /** Construct a new DisplayStyleSettings from an [[ElementProps.jsonProperties]].
   * @param jsonProperties An object with an optional `styles` property containing a display style's settings.
   * @note When the `DisplayStyleSetting`'s properties are modified by public setters, the `jsonProperties`'s `styles` object will be updated to reflect the change.
   * @note If `jsonProperties` contains no `styles` member, one will be added as an empty object.
   * @note Generally there is no reason to create an object of this type directly; a [[DisplayStyle]] or [[DisplayStyleState]] constructs one as part of its own construction.
   */
  public constructor(jsonProperties: { styles?: DisplayStyleSettingsProps }) {
    if (undefined === jsonProperties.styles)
      jsonProperties.styles = {};

    this._json = jsonProperties.styles;
    this._viewFlags = ViewFlags.fromJSON(this._json.viewflags);
    this._background = ColorDef.fromJSON(this._json.backgroundColor);

    this._monochrome = undefined !== this._json.monochromeColor ? ColorDef.fromJSON(this._json.monochromeColor) : ColorDef.white;
    this._monochromeMode = MonochromeMode.Flat === this._json.monochromeMode ? MonochromeMode.Flat : MonochromeMode.Scaled;

    this._backgroundMap = BackgroundMapSettings.fromJSON(this._json.backgroundMap);
    this._mapImagery = MapImagerySettings.fromJSON(this._json.mapImagery, this._json.backgroundMap);

    this._excludedElements = new ExcludedElements(this._json);

    if (this._json.analysisStyle)
      this._analysisStyle = AnalysisStyle.fromJSON(this._json.analysisStyle);

    this.populateSubCategoryOverridesFromJSON();
    this.populateModelAppearanceOverridesFromJSON();

    this._clipStyle = ClipStyle.fromJSON(this._json.clipStyle);
  }

  private populateSubCategoryOverridesFromJSON(): void {
    this._subCategoryOverrides.clear();
    const ovrsArray = JsonUtils.asArray(this._json.subCategoryOvr);
    if (undefined !== ovrsArray) {
      for (const ovrJson of ovrsArray) {
        const subCatId = Id64.fromJSON(ovrJson.subCategory);
        if (Id64.isValid(subCatId)) {
          const subCatOvr = SubCategoryOverride.fromJSON(ovrJson);
          if (subCatOvr.anyOverridden)
            this.changeSubCategoryOverride(subCatId, false, subCatOvr);
        }
      }
    }
  }

  private populateModelAppearanceOverridesFromJSON(): void {
    this._modelAppearanceOverrides.clear();
    const ovrsArray = JsonUtils.asArray(this._json.modelOvr);
    if (undefined !== ovrsArray) {
      for (const ovrJson of ovrsArray) {
        const modelId = Id64.fromJSON(ovrJson.modelId);
        if (Id64.isValid(modelId)) {
          const appearance = FeatureAppearance.fromJSON(ovrJson);
          if (appearance.anyOverridden)
            this.changeModelAppearanceOverride(modelId, false, appearance);
        }
      }
    }
  }
  /** The ViewFlags associated with the display style.
   * @note If the style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.viewFlags]] to modify the ViewFlags to ensure
   * the changes are promptly visible on the screen.
   * @note Do not modify the ViewFlags in place. Clone them and pass the clone to the setter.
   */
  public get viewFlags(): ViewFlags { return this._viewFlags; }
  public set viewFlags(flags: ViewFlags) {
    flags.clone(this._viewFlags);
    this._json.viewflags = flags.toJSON();
  }

  /** The background color.
   * @note Do not modify the color in place. Clone it and pass the clone to the setter.
   */
  public get backgroundColor(): ColorDef { return this._background; }
  public set backgroundColor(color: ColorDef) {
    this._background = color;
    this._json.backgroundColor = color.toJSON();
  }

  /** The color used to draw geometry in monochrome mode.
   * @note Do not modify the color in place. Clone it and pass the clone to the setter.
   * @see [[ViewFlags.monochrome]] for enabling monochrome mode.
   */
  public get monochromeColor(): ColorDef { return this._monochrome; }
  public set monochromeColor(color: ColorDef) {
    this._monochrome = color;
    this._json.monochromeColor = color.toJSON();
  }

  /** The style in which [[monochromeColor]] is applied. */
  public get monochromeMode(): MonochromeMode { return this._monochromeMode; }
  public set monochromeMode(mode: MonochromeMode) {
    this._monochromeMode = mode;
    this._json.monochromeMode = mode;
  }

  /** Settings controlling display of the background map within the view. */
  public get backgroundMap(): BackgroundMapSettings { return this._backgroundMap; }

  public set backgroundMap(map: BackgroundMapSettings) {
    if (!this.backgroundMap.equals(map)) {
      this._backgroundMap = map; // it's an immutable type.
      this._json.backgroundMap = map.toJSON();
    }
  }

  /** Get the map imagery for this display style.  Map imagery includes the background map base as well as background layers and overlay layers.
   * In earlier versions only a background map image was supported as specified by the providerName and mapType members of [[BackgroundMapSettings]] object.
   * In order to provide backward compatibility the original [[BackgroundMapSettings]] are synchronized with the [[MapImagerySettings]] base layer as long as
   * the settings are compatible.  The map imagery typically only should be modified only through  [DisplayStyleState]($frontend) methods.
   * Map imagery should only be modified from backend, changes to map imagery from front end should be handled only through [DisplayStyleState]($frontend) methods.
   * @alpha
   */
  public get mapImagery(): MapImagerySettings { return this._mapImagery; }

  public set mapImagery(mapImagery: MapImagerySettings) {
    this._mapImagery = mapImagery;
    this._json.mapImagery = this._mapImagery.toJSON();
  }

  /** @internal
   * Handles keeping the map imagery layers in synch after changes have been made (used internally only by front end)
   */
  public synchMapImagery() { this._json.mapImagery = this._mapImagery.toJSON(); }

  /** @internal */
  public get scheduleScriptProps(): RenderSchedule.ModelTimelineProps[] | undefined {
    return this._json.scheduleScript;
  }
  public set scheduleScriptProps(props: RenderSchedule.ModelTimelineProps[] | undefined) {
    this._json.scheduleScript = props;
  }

  /** The point in time reflected by the view, in UNIX seconds.
   * This identifies a point on the timeline of the [[scheduleScript]], if any; it may also affect display of four-dimensional reality models.
   * @beta
   */
  public get timePoint(): number | undefined {
    return this._json.timePoint;
  }
  public set timePoint(timePoint: number | undefined) {
    this._json.timePoint = timePoint;
  }

  /** Settings controlling the display of analytical models.
   * @note Do not modify this object directly. Instead, create a clone and pass it to the setter.
   * @alpha
   */
  public get analysisStyle(): AnalysisStyle | undefined { return this._analysisStyle; }
  public set analysisStyle(style: AnalysisStyle | undefined) {
    if (!style) {
      this._json.analysisStyle = undefined;
      this._analysisStyle = undefined;
      return;
    }
    this._analysisStyle = style.clone(this._analysisStyle);
    this._json.analysisStyle = style.toJSON();
  }

  /** @alpha */
  public get analysisFraction(): number {
    const fraction = this._json.analysisFraction ?? 0;
    return Math.max(0, Math.min(1, fraction));
  }
  public set analysisFraction(fraction: number) {
    this._json.analysisFraction = Math.max(0, Math.min(1, fraction));
  }

  /** Customize the way geometry belonging to a [[SubCategory]] is drawn by this display style.
   * @param id The ID of the SubCategory whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [[SubCategoryAppearance]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[Viewport.overrideSubCategory]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void { this.changeSubCategoryOverride(id, true, ovr); }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[Viewport.dropSubCategoryOverride]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String): void { this.changeSubCategoryOverride(id, true); }

  /** The overrides applied by this style. */
  public get subCategoryOverrides(): Map<Id64String, SubCategoryOverride> { return this._subCategoryOverrides; }

  /** Obtain the override applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @returns The corresponding SubCategoryOverride, or undefined if the SubCategory's appearance is not overridden.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined { return this._subCategoryOverrides.get(id); }

  /** Returns true if an [[SubCategoryOverride]s are defined by this style. */
  public get hasSubCategoryOverride(): boolean { return this._subCategoryOverrides.size > 0; }

  /** Customize the way a [[Model]]  is drawn by this display style.
   * @param modelId The ID of the [[model]] whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [[Model]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[Viewport.overrideModelAppearance]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[dropModelAppearanceOverride]]
   */
  public overrideModelAppearance(modelId: Id64String, ovr: FeatureAppearance): void { this.changeModelAppearanceOverride(modelId, true, ovr); }

  /** Remove any appearance overrides applied to a [[Model]] by this style.
   * @param modelId The ID of the [[Model]].
   * @param ovr The overrides to apply to the [[Model]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[Viewport.dropModelAppearanceOverride]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[overrideModelAppearance]]
   */
  public dropModelAppearanceOverride(id: Id64String): void { this.changeModelAppearanceOverride(id, true); }

  /** The overrides applied by this style. */
  public get modelAppearanceOverrides(): Map<Id64String, FeatureAppearance> { return this._modelAppearanceOverrides; }

  /** Obtain the override applied to a [[Model]] by this style.
   * @param id The ID of the [[Model]].
   * @returns The corresponding FeatureAppearance, or undefined if the Model's appearance is not overridden.
   * @see [[overrideModelAppearance]]
   */
  public getModelAppearanceOverride(id: Id64String): FeatureAppearance | undefined {
    return this._modelAppearanceOverrides.get(id);
  }

  /** Returns true if model appearance overrides are defined by this style. */
  public get hasModelAppearanceOverride(): boolean {
    return this._modelAppearanceOverrides.size > 0;
  }

  /** The set of elements that will not be drawn by this display style.
   * @returns The set of excluded elements.
   * @note The set and the Ids it contains may be very large. It is allocated the first time this property is requested.
   * @deprecated Use [[excludedElementIds]] for better performance and reduced memory overhead, unless efficient lookup of Ids within the set is required.
   */
  public get excludedElements(): Set<Id64String> {
    return this._excludedElements.obtainSet();
  }

  /** The set of elements that will not be drawn by this display style.
   * @returns An iterable over the elements' Ids.
   */
  public get excludedElementIds(): OrderedId64Iterable {
    return this._excludedElements;
  }

  /** @internal */
  public get compressedExcludedElementIds(): CompressedId64Set {
    return this._excludedElements.ids;
  }

  /** Add one or more elements to the set of elements not to be displayed.
   * @param id The IDs of the element(s) to be excluded.
   */
  public addExcludedElements(id: Id64String | Iterable<Id64String>) {
    this._excludedElements.add("string" === typeof id ? [id] : id);
  }

  /** Remove an element from the set of elements not to be displayed. */
  public dropExcludedElement(id: Id64String): void {
    this._excludedElements.delete([id]);
  }

  /** Remove one or more elements from the set of elements not to be displayed.
   * @param id The IDs of the element(s) to be removed from the set of excluded elements.
   */
  public dropExcludedElements(id: Id64String | Iterable<Id64String>) {
    this._excludedElements.delete("string" === typeof id ? [id] : id);
  }

  /** Remove all elements from the set of elements not to be displayed. */
  public clearExcludedElements(): void {
    this._excludedElements.reset(undefined);
  }

  /** The style applied to the view's [ClipVector]($geometry-core).
   * @beta
   */
  public get clipStyle(): ClipStyle {
    return this._clipStyle;
  }
  public set clipStyle(style: ClipStyle) {
    this._clipStyle = style;
    if (style.matchesDefaults)
      delete this._json.clipStyle;
    else
      this._json.clipStyle = style.toJSON();
  }

  /** @internal */
  public toJSON(): DisplayStyleSettingsProps {
    return this._json;
  }

  /** Serialize a subset of these settings to JSON, such that they can be applied to another DisplayStyleSettings to selectively override those settings.
   * @param options Specifies which settings should be serialized. By default, settings that are specific to an iModel (e.g., subcategory overrides) or project (e.g., context reality models)
   * are omitted, as are drawing aids (e.g., ACS triad and grid).
   * @returns a JSON representation of the selected settings suitable for passing to [[applyOverrides]].
   * @see [[applyOverrides]] to apply the overrides to another DisplayStyleSettings..
   * @beta
   */
  public toOverrides(options?: DisplayStyleOverridesOptions): DisplayStyleSettingsProps {
    if (options?.includeAll) {
      return {
        ...this.toJSON(),
        viewflags: this.viewFlags.toFullyDefinedJSON(),
      };
    }

    const viewflags = this.viewFlags.toFullyDefinedJSON();
    const props: DisplayStyleSettingsProps = {
      viewflags,
      backgroundColor: this.backgroundColor.toJSON(),
      monochromeColor: this.monochromeColor.toJSON(),
      monochromeMode: this.monochromeMode,
    };

    if (options?.includeBackgroundMap)
      props.backgroundMap = this.backgroundMap.toJSON();
    else
      delete viewflags.backgroundMap;

    if (!options?.includeDrawingAids) {
      delete viewflags.acs;
      delete viewflags.grid;
    }

    if (options?.includeProjectSpecific || options?.includeIModelSpecific) {
      props.timePoint = this.timePoint;
      if (this._json.contextRealityModels) {
        props.contextRealityModels = this._json.contextRealityModels;
        if (!options?.includeIModelSpecific)
          for (const model of this._json.contextRealityModels)
            delete model.classifiers;
      }
    }

    if (options?.includeIModelSpecific) {
      if (this.analysisStyle) {
        props.analysisStyle = this.analysisStyle.toJSON();
        props.analysisFraction = this.analysisFraction;
      }

      if (this.scheduleScriptProps)
        props.scheduleScript = [...this.scheduleScriptProps];

      props.subCategoryOvr = this._json.subCategoryOvr ? [...this._json.subCategoryOvr] : [];
      props.modelOvr = this._json.modelOvr ? [...this._json.modelOvr] : [];
      props.excludedElements = this._excludedElements.ids;
    }

    return props;
  }

  /** Selectively override some of these settings. Any field that is explicitly defined by the input will be overridden in these settings; any fields left undefined in the input
   * will retain their current values in these settings. The input's [[ViewFlags]] are applied individually - only those flags that are explicitly defined will be overridden.
   * For example, the following overrides will set the render mode to "smooth", change the background color to white, turn shadows off, and leave all other settings intact:
   * ```ts
   *  {
   *    viewflags: {
   *      renderMode: RenderMode.SmoothShade,
   *      shadows: false,
   *    },
   *    backgroundColor: ColorByName.white,
   *  }
   * ```
   * @see [[toOverrides]] to produce overrides from an existing DisplayStyleSettings.
   * @note If these settings are associated with a [Viewport]($frontend), prefer to use [Viewport.overrideDisplayStyle]($frontend) to ensure the viewport's contents are automatically updated.
   * @beta
   */
  public applyOverrides(overrides: DisplayStyleSettingsProps): void {
    this._applyOverrides(overrides);
    this.onOverridesApplied.raiseEvent(this, overrides);
  }

  /** @internal */
  protected _applyOverrides(overrides: DisplayStyleSettingsProps): void {
    if (overrides.viewflags) {
      this.viewFlags = ViewFlags.fromJSON({
        ...this.viewFlags.toJSON(),
        ...overrides.viewflags,
      });
    }

    if (undefined !== overrides.backgroundColor)
      this.backgroundColor = ColorDef.fromJSON(overrides.backgroundColor);

    if (undefined !== overrides.monochromeColor)
      this.monochromeColor = ColorDef.fromJSON(overrides.monochromeColor);

    if (undefined !== overrides.monochromeMode)
      this.monochromeMode = overrides.monochromeMode;

    if (overrides.backgroundMap)
      this.backgroundMap = BackgroundMapSettings.fromJSON(overrides.backgroundMap);

    if (undefined !== overrides.timePoint)
      this.timePoint = overrides.timePoint;

    if (overrides.contextRealityModels)
      this._json.contextRealityModels = [...overrides.contextRealityModels];

    if (overrides.analysisStyle)
      this.analysisStyle = AnalysisStyle.fromJSON(overrides.analysisStyle);

    if (undefined !== overrides.analysisFraction)
      this.analysisFraction = overrides.analysisFraction;

    if (overrides.scheduleScript)
      this.scheduleScriptProps = [...overrides.scheduleScript];

    if (overrides.subCategoryOvr) {
      this._json.subCategoryOvr = [...overrides.subCategoryOvr];
      this.populateSubCategoryOverridesFromJSON();
    }

    if (overrides.modelOvr) {
      this._json.modelOvr = [...overrides.modelOvr];
      this.populateModelAppearanceOverridesFromJSON();
    }

    if (overrides.excludedElements)
      this._excludedElements.reset("string" === typeof overrides.excludedElements ? overrides.excludedElements : [...overrides.excludedElements]);
  }

  private findIndexOfSubCategoryOverrideInJSON(id: Id64String, allowAppend: boolean): number {
    const ovrsArray = JsonUtils.asArray(this._json.subCategoryOvr);
    if (undefined === ovrsArray) {
      if (allowAppend) {
        this._json.subCategoryOvr = [];
        return 0;
      } else {
        return -1;
      }
    } else {
      for (let i = 0; i < ovrsArray.length; i++) {
        if (ovrsArray[i].subCategory === id)
          return i;
      }

      return allowAppend ? ovrsArray.length : -1;
    }
  }

  private changeSubCategoryOverride(id: Id64String, updateJson: boolean, ovr?: SubCategoryOverride): void {
    if (undefined === ovr) {
      // undefined => drop the override if present.
      this._subCategoryOverrides.delete(id);
      if (updateJson) {
        const index = this.findIndexOfSubCategoryOverrideInJSON(id, false);
        if (-1 !== index)
          this._json.subCategoryOvr!.splice(index, 1);
      }
    } else {
      // add override, or update if present.
      this._subCategoryOverrides.set(id, ovr);
      if (updateJson) {
        const index = this.findIndexOfSubCategoryOverrideInJSON(id, true);
        this._json.subCategoryOvr![index] = ovr.toJSON();
        this._json.subCategoryOvr![index].subCategory = id;
      }
    }
  }

  /** @internal */
  public equalSubCategoryOverrides(other: DisplayStyleSettings): boolean {
    if (this._subCategoryOverrides.size !== other._subCategoryOverrides.size)
      return false;

    for (const [key, value] of this._subCategoryOverrides.entries()) {
      const otherValue = other._subCategoryOverrides.get(key);
      if (undefined === otherValue || !value.equals(otherValue))
        return false;
    }

    return true;
  }

  private findIndexOfModelAppearanceOverrideInJSON(id: Id64String, allowAppend: boolean): number {
    const ovrsArray = JsonUtils.asArray(this._json.modelOvr);
    if (undefined === ovrsArray) {
      if (allowAppend) {
        this._json.modelOvr = [];
        return 0;
      } else {
        return -1;
      }
    } else {
      for (let i = 0; i < ovrsArray.length; i++) {
        if (ovrsArray[i].modelId === id)
          return i;
      }

      return allowAppend ? ovrsArray.length : -1;
    }
  }

  private changeModelAppearanceOverride(id: Id64String, updateJson: boolean, ovr?: FeatureAppearance): void {
    if (undefined === ovr) {
      // undefined => drop the override if present.
      this._modelAppearanceOverrides.delete(id);
      if (updateJson) {
        const index = this.findIndexOfModelAppearanceOverrideInJSON(id, false);
        if (-1 !== index)
          this._json.modelOvr!.splice(index, 1);
      }
    } else {
      // add override, or update if present.
      this._modelAppearanceOverrides.set(id, ovr);
      if (updateJson) {
        const index = this.findIndexOfModelAppearanceOverrideInJSON(id, true);
        this._json.modelOvr![index] = ovr.toJSON();
        this._json.modelOvr![index].modelId = id;
      }
    }
  }

  /** @internal */
  public equalModelAppearanceOverrides(other: DisplayStyleSettings): boolean {
    if (this._modelAppearanceOverrides.size !== other._modelAppearanceOverrides.size)
      return false;

    for (const [key, value] of this._modelAppearanceOverrides.entries()) {
      const otherValue = other._modelAppearanceOverrides.get(key);
      if (undefined === otherValue || !value.equals(otherValue))
        return false;
    }

    return true;
  }

  /** @internal */
  public readonly onOverridesApplied = new BeEvent<(settings: DisplayStyleSettings, overrides: DisplayStyleSettingsProps) => void>();
}

/** Provides access to the settings defined by a [[DisplayStyle3d]] or [[DisplayStyle3dState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @public
 */
export class DisplayStyle3dSettings extends DisplayStyleSettings {
  private _thematic: ThematicDisplay;
  private _hline: HiddenLine.Settings;
  private _ao: AmbientOcclusion.Settings;
  private _solarShadows: SolarShadowSettings;
  private _lights: LightSettings;
  private _planProjections?: Map<string, PlanProjectionSettings>;

  private get _json3d(): DisplayStyle3dSettingsProps { return this._json as DisplayStyle3dSettingsProps; }

  public constructor(jsonProperties: { styles?: DisplayStyle3dSettingsProps }) {
    super(jsonProperties);
    this._thematic = ThematicDisplay.fromJSON(this._json3d.thematic);
    this._hline = HiddenLine.Settings.fromJSON(this._json3d.hline);
    this._ao = AmbientOcclusion.Settings.fromJSON(this._json3d.ao);
    this._solarShadows = SolarShadowSettings.fromJSON(this._json3d.solarShadows);

    // Very long ago we used to stick MicroStation's light settings into json.sceneLights. Later we started adding the sunDir.
    // We don't want any of MicroStation's settings. We do want to preserve the sunDir if present.
    if (this._json3d.lights) {
      this._lights = LightSettings.fromJSON(this._json3d.lights);
    } else {
      const sunDir = this._json3d.sceneLights?.sunDir; // eslint-disable-line deprecation/deprecation
      this._lights = LightSettings.fromJSON(sunDir ? { solar: { direction: sunDir } } : undefined);
    }

    this.populatePlanProjectionsFromJSON();
  }

  private populatePlanProjectionsFromJSON(): void {
    this._planProjections = undefined;
    const projections = this._json3d.planProjections;
    if (undefined !== projections) {
      for (const key of Object.keys(projections)) {
        const id = Id64.fromJSON(key);
        if (!Id64.isValidId64(id)) {
          delete projections[key];
          continue;
        }

        const settings = PlanProjectionSettings.fromJSON(projections[key]);
        if (undefined === settings) {
          delete projections[key];
          continue;
        }

        if (undefined === this._planProjections)
          this._planProjections = new Map<string, PlanProjectionSettings>();

        this._planProjections.set(id, settings);
      }
    }
  }

  /** @internal */
  public toJSON(): DisplayStyle3dSettingsProps {
    return this._json3d;
  }

  /** Serialize a subset of these settings to JSON, such that they can be applied to another DisplayStyleSettings to selectively override those settings.
   * @param options Specifies which settings should be serialized. By default, settings that are specific to an iModel (e.g., subcategory overrides) or project (e.g., context reality models)
   * are omitted, as are drawing aids (e.g., ACS triad and grid).
   * @returns a JSON representation of the selected settings suitable for passing to [[applyOverrides]].
   * @see [[applyOverrides]] to apply the overrides to another DisplayStyleSettings..
   * @beta
   */
  public toOverrides(options?: DisplayStyleOverridesOptions): DisplayStyle3dSettingsProps {
    const props = super.toOverrides(options) as DisplayStyle3dSettingsProps;
    if (options?.includeAll)
      return props;

    assert(undefined !== props.viewflags);

    props.environment = { ...this.environment };
    props.hline = this.hiddenLineSettings.toJSON();
    props.ao = this.ambientOcclusionSettings.toJSON();
    props.solarShadows = this.solarShadows.toJSON();
    props.lights = this.lights.toJSON();

    if (options?.includeIModelSpecific) {
      props.thematic = this.thematic.toJSON();
      if (this._json3d.planProjections)
        props.planProjections = { ...this._json3d.planProjections };
    } else if (ThematicDisplayMode.InverseDistanceWeightedSensors !== this.thematic.displayMode) {
      props.thematic = {
        ...this.thematic.toJSON(),
        sensorSettings: undefined,
      };

      if (ThematicDisplayMode.Height === props.thematic.displayMode) {
        // DisplayStyle3dState will compute range based on project extents.
        props.thematic.range = undefined;
      }
    }

    return props;
  }

  /** Selectively override some of these settings. Any field that is explicitly defined by the input will be overridden in these settings; any fields left undefined in the input
   * will retain their current values in these settings. The input's [[ViewFlags]] are applied individually - only those flags that are explicitly defined will be overridden.
   * For example, the following overrides will set the render mode to "smooth", change the background color to white, turn shadows off, and leave all other settings intact:
   * ```ts
   *  {
   *    viewflags: {
   *      renderMode: RenderMode.SmoothShade,
   *      shadows: false,
   *    },
   *    backgroundColor: ColorByName.white,
   *  }
   * ```
   * @see [[toOverrides]] to produce overrides from an existing DisplayStyleSettings.
   * @note If these settings are associated with a [Viewport]($frontend), prefer to use [Viewport.overrideDisplayStyle]($frontend) to ensure the viewport's contents are automatically updated.
   * @beta
   */
  public applyOverrides(overrides: DisplayStyle3dSettingsProps): void {
    super._applyOverrides(overrides);

    if (overrides.environment)
      this.environment = { ...overrides.environment };

    if (overrides.hline)
      this.hiddenLineSettings = HiddenLine.Settings.fromJSON(overrides.hline);

    if (overrides.ao)
      this.ambientOcclusionSettings = AmbientOcclusion.Settings.fromJSON(overrides.ao);

    if (overrides.solarShadows)
      this.solarShadows = SolarShadowSettings.fromJSON(overrides.solarShadows);

    if (overrides.lights)
      this.lights = LightSettings.fromJSON(overrides.lights);

    if (overrides.planProjections) {
      this._json3d.planProjections = { ...overrides.planProjections };
      this.populatePlanProjectionsFromJSON();
    }

    if (overrides.thematic)
      this.thematic = ThematicDisplay.fromJSON(overrides.thematic);

    this.onOverridesApplied.raiseEvent(this, overrides);
  }

  /** The settings that control thematic display.
   * @beta
   */
  public get thematic(): ThematicDisplay { return this._thematic; }
  public set thematic(thematic: ThematicDisplay) {
    this._thematic = thematic;
    this._json3d.thematic = thematic.toJSON();
  }

  /** The settings that control how visible and hidden edges are displayed.  */
  public get hiddenLineSettings(): HiddenLine.Settings { return this._hline; }
  public set hiddenLineSettings(hline: HiddenLine.Settings) {
    this._hline = hline;
    this._json3d.hline = hline.toJSON();
  }

  /** The settings that control how ambient occlusion is displayed. */
  public get ambientOcclusionSettings(): AmbientOcclusion.Settings { return this._ao; }
  public set ambientOcclusionSettings(ao: AmbientOcclusion.Settings) {
    this._ao = ao;
    this._json3d.ao = ao.toJSON();
  }

  /** The settings that control how solar shadows are displayed. */
  public get solarShadows(): SolarShadowSettings {
    return this._solarShadows;
  }
  public set solarShadows(solarShadows: SolarShadowSettings) {
    this._solarShadows = solarShadows;
    const json = solarShadows.toJSON();
    if (!json)
      delete this._json3d.solarShadows;
    else
      this._json3d.solarShadows = json;
  }

  /** @internal */
  public get environment(): EnvironmentProps {
    const env = this._json3d.environment;
    return undefined !== env ? env : {};
  }
  public set environment(environment: EnvironmentProps) {
    this._json3d.environment = environment;
  }

  public get lights(): LightSettings {
    return this._lights;
  }
  public set lights(lights: LightSettings) {
    this._lights = lights;
    this._json3d.lights = lights.toJSON();
  }

  /** Get the plan projection settings associated with the specified model, if defined.
   * @beta
   */
  public getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined {
    return undefined !== this._planProjections ? this._planProjections.get(modelId) : undefined;
  }

  /** Set or clear the plan projection settings associated with the specified model.
   * @beta
   */
  public setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined): void {
    if (undefined === settings) {
      if (undefined !== this._planProjections) {
        assert(undefined !== this._json3d.planProjections);

        this._planProjections.delete(modelId);
        delete this._json3d.planProjections[modelId];

        if (0 === this._planProjections.size) {
          this._planProjections = undefined;
          delete this._json3d.planProjections;
        }
      }

      return;
    }

    if (undefined === this._planProjections) {
      this._planProjections = new Map<string, PlanProjectionSettings>();
      this._json3d.planProjections = {};
    }

    this._planProjections.set(modelId, settings);
    this._json3d.planProjections![modelId] = settings.toJSON();
  }

  /** An iterator over all of the defined plan projection settings. The iterator includes the Id of the model associated with each settings object.
   * @beta
   */
  public get planProjectionSettings(): Iterable<[Id64String, PlanProjectionSettings]> | undefined {
    return undefined !== this._planProjections ? this._planProjections.entries() : undefined;
  }
}
