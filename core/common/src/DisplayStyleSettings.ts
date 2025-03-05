/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

// cspell:ignore greyscale ovrs

import {
  assert, BeEvent, CompressedId64Set, Id64, Id64Array, Id64String, JsonUtils, MutableCompressedId64Set, OrderedId64Iterable,
} from "@itwin/core-bentley";
import { XYZProps } from "@itwin/core-geometry";
import { AmbientOcclusion } from "./AmbientOcclusion";
import { AnalysisStyle, AnalysisStyleProps } from "./AnalysisStyle";
import { BackgroundMapSettings, PersistentBackgroundMapProps } from "./BackgroundMapSettings";
import { ClipStyle, ClipStyleProps } from "./ClipStyle";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { DefinitionElementProps } from "./ElementProps";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";
import { PlanarClipMaskProps, PlanarClipMaskSettings } from "./PlanarClipMask";
import { SubCategoryOverride } from "./SubCategoryOverride";
import { LightSettings, LightSettingsProps } from "./LightSettings";
import { MapImageryProps, MapImagerySettings } from "./MapImagerySettings";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "./PlanProjectionSettings";
import { RenderSchedule } from "./RenderSchedule";
import { Environment, EnvironmentProps } from "./Environment";
import { SolarShadowSettings, SolarShadowSettingsProps } from "./SolarShadows";
import { SubCategoryAppearance } from "./SubCategoryAppearance";
import { ThematicDisplay, ThematicDisplayMode, ThematicDisplayProps } from "./ThematicDisplay";
import { ViewFlagProps, ViewFlags } from "./ViewFlags";
import { Cartographic } from "./geometry/Cartographic";
import { IModel } from "./IModel";
import { calculateSolarDirection } from "./SolarCalculate";
import { ContextRealityModel, ContextRealityModelProps, ContextRealityModels } from "./ContextRealityModel";
import { RealityModelDisplayProps, RealityModelDisplaySettings } from "./RealityModelDisplaySettings";
import { WhiteOnWhiteReversalProps, WhiteOnWhiteReversalSettings } from "./WhiteOnWhiteReversalSettings";
import { ContourDisplay, ContourDisplayProps } from "./ContourDisplay";

/** Describes the [[SubCategoryOverride]]s applied to a [[SubCategory]] by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 * @extensions
 */
export interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  /** The Id of the [[SubCategory]] whose appearance is to be overridden. */
  subCategory?: Id64String;
}

/** A [[FeatureAppearanceProps]] applied to a specific model to override its appearance within the context of a [DisplayStyle]($backend).
 * @see [[DisplayStyleSettingsProps.modelOvr]].
 * @public
 * @extensions
 */
export interface DisplayStyleModelAppearanceProps extends FeatureAppearanceProps {
  /** The Id of the model whose appearance is to be overridden. */
  modelId: Id64String;
}

/** [[RealityModelDisplaySettings]] applied to a reality [Model]($backend) to change how it is rendered within the context of a [DisplayStyle]($backend).
 * @see [[DisplayStyleSettingsProps.realityModelDisplay]].
 * @beta
 */
export interface DisplayStyleRealityModelDisplayProps extends RealityModelDisplayProps {
  /** The Id of the reality [Model]($backend) to which the settings apply. */
  modelId?: Id64String;
}

/** A [[PlanarClipMaskProps]] associated with a specific reality model.
 * @see [[DisplayStyleSettingsProps.planarClipOvr]].
 * @public
 * @extensions
 */
export interface DisplayStylePlanarClipMaskProps extends PlanarClipMaskProps {
  /** The Id of the model to mask. */
  modelId?: Id64String;
}

/** Describes the style in which monochrome color is applied by a [[DisplayStyleSettings]].
 * @public
 * @extensions
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

/** JSON representation of the [[DisplayStyleSettings]] associated with a [[DisplayStyleProps]].
 * These settings are not stored directly as members of the [[DisplayStyleProps]]. Instead, they are stored
 * as members of [[DisplayStyleProps.jsonProperties.styles]].
 * @public
 * @extensions
 */
export interface DisplayStyleSettingsProps {
  /** See [[DisplayStyleSettings.viewFlags]].
   * @note Be careful with the case of this field - it is spelled in all lower-case letters, while [[DisplayStyleSettings.viewFlags]] is spelled `viewFlags`.
   */
  viewflags?: ViewFlagProps;
  /** See [[DisplayStyleSettings.backgroundColor]]. */
  backgroundColor?: ColorDefProps;
  /** See [[DisplayStyleSettings.monochromeColor]]. */
  monochromeColor?: ColorDefProps;
  /** See [[DisplayStyleSettings.monochromeMode]]. */
  monochromeMode?: MonochromeMode;
  /** See [[DisplayStyleSettings.analysisStyle]]. */
  analysisStyle?: AnalysisStyleProps;
  /** See [[DisplayStyleSettings.analysisFraction]]. */
  analysisFraction?: number;
  /** See [[DisplayStyleSettings.scheduleScriptProps]]. */
  scheduleScript?: RenderSchedule.ScriptProps;
  /** See [[DisplayStyleSettings.renderTimeline]]. */
  renderTimeline?: Id64String;
  /** See [[DisplayStyleSettings.timePoint]]. */
  timePoint?: number;
  /** Overrides applied to the appearances of subcategories in the view.
   * See [[DisplayStyleSettings.overrideSubCategory]].
   */
  subCategoryOvr?: DisplayStyleSubCategoryProps[];
  /** See [[DisplayStyleSettings.backgroundMap]]. */
  backgroundMap?: PersistentBackgroundMapProps;
  /** See [[DisplayStyleSettings.contextRealityModels]]. */
  contextRealityModels?: ContextRealityModelProps[];
  /** Ids of elements not to be displayed in the view. Prefer the compressed format, especially when sending between frontend and backend - the number of Ids may be quite large.
   * See [[DisplayStyleSettings.excludedElements]].
   */
  excludedElements?: Id64Array | CompressedId64Set;
  /** See [[DisplayStyleSettings.mapImagery]].
   * @beta
   */
  mapImagery?: MapImageryProps;
  /** Overrides applied to the appearance of models in the view.
   * See [[DisplayStyleSettings.overrideModelAppearance]].
   */
  modelOvr?: DisplayStyleModelAppearanceProps[];
  /** Display settings applied to specific reality models in the view.
   * @see [[DisplayStyleSettings.setRealityModelDisplaySettings]].
   * @beta
   */
  realityModelDisplay?: DisplayStyleRealityModelDisplayProps[];
  /** See [[DisplayStyleSettings.clipStyle]]. */
  clipStyle?: ClipStyleProps;
  /** See [[DisplayStyleSettings.planarClipMasks]]. */
  planarClipOvr?: DisplayStylePlanarClipMaskProps[];
  /** See [[DisplayStyleSettings.whiteOnWhiteReversal]]. */
  whiteOnWhiteReversal?: WhiteOnWhiteReversalProps;
}

/** JSON representation of [[DisplayStyle3dSettings]]  associated with a [[DisplayStyle3dProps]].
 * @public
 * @extensions
 */
export interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  /** See [[DisplayStyle3dSettings.environment]]. */
  environment?: EnvironmentProps;
  /** See [[DisplayStyle3dSettings.thematic]]. */
  thematic?: ThematicDisplayProps;
  /** See [[DisplayStyle3dSettings.contours]]. */
  contours?: ContourDisplayProps;
  /** See [[DisplayStyle3dSettings.hiddenLineSettings]]. */
  hline?: HiddenLine.SettingsProps;
  /** See [[DisplayStyle3dSettings.ambientOcclusionSettings]]. */
  ao?: AmbientOcclusion.Props;
  /** See [[DisplayStyle3dSettings.solarShadows]]. */
  solarShadows?: SolarShadowSettingsProps;
  /** See [[DisplayStyle3dSettings.lights]]. */
  lights?: LightSettingsProps;
  /** See [[DisplayStyle3dSettings.planProjections]]. */
  planProjections?: { [modelId: string]: PlanProjectionSettingsProps };
  /** Old lighting settings - only `sunDir` was ever used; it is now part of [[lights]].
   * DisplayStyle3dSettings will construct a LightSettings from sceneLights.sunDir IFF [[lights]] is not present.
   * @internal
   */
  sceneLights?: { sunDir?: XYZProps };
}

/** JSON representation of a [[DisplayStyle]] or [[DisplayStyleState]].
 * @public
 * @extensions
 */
export interface DisplayStyleProps extends DefinitionElementProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyleSettingsProps;
  };
}

/** JSON representation of a [[DisplayStyle3d]] or [[DisplayStyle3dState]].
 * @public
 * @extensions
 */
export interface DisplayStyle3dProps extends DisplayStyleProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyle3dSettingsProps;
  };
}

/** Controls which settings are serialized by [[DisplayStyleSettings.toOverrides]]. A display style includes some settings that are specific to a given iModel - for example,
 * the subcategory overrides are indexed by subcategory Ids and model appearance overrides are indexed by model ids. Other settings are specific to a given iTwin, like the set of displayed context reality models. Such settings can be useful
 * when creating display style overrides intended for use with a specific iModel or iTwin, but should be omitted when creating general-purpose display style overrides intended
 * for use with any iModel or iTwin. This is the default behavior if no more specific options are provided.
 * @public
 * @extensions
 */
export interface DisplayStyleOverridesOptions {
  /** Serialize all settings. Applying the resultant [[DisplayStyleSettingsProps]] will produce a [[DisplayStyleSettings]] identical to the original settings. */
  includeAll?: true;
  /** Serialize iModel-specific settings. These settings are only meaningful within the context of a specific iModel. Setting this to `true` implies all iTwin-specific settings will be serialized too.
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
  /** Serialize iTwin-specific settings. These settings are only meaningful within the context of a specific iTwin. These settings are always included if `includeIModelSpecific` is `true`.
   * The following are iTwin-specific settings:
   *  * Context reality models. If iModel-specific settings are *not* serialized, the classifiers will be omitted.
   *  * Time point.
   */
  includeITwinSpecific?: true;
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
      this._ids.reset((ids && "string" !== typeof ids) ? CompressedId64Set.compressIds(ids) : ids);
    });
  }

  public get ids(): CompressedId64Set {
    return this._ids.ids;
  }

  public add(ids: Iterable<Id64String>): void {
    this.synchronize(() => {
      for (const id of ids)
        this._ids.add(id);
    });
  }

  public delete(ids: Iterable<Id64String>): void {
    this.synchronize(() => {
      for (const id of ids)
        this._ids.delete(id);
    });
  }

  public [Symbol.iterator]() {
    return this._ids[Symbol.iterator]();
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

type OverridesArrayKey = "subCategoryOvr" | "modelOvr" | "planarClipOvr" | "realityModelDisplay";

/** An implementation of Map that is based on a JSON array, used for a display styles subcategory overrides, model appearance overrides,
 * and planar clip masks. Ensures:
 *  - JSON representation kept in sync with changes to map; and
 *  - Events dispatched when map contents change.
 */
class OverridesMap<OverrideProps, Override> extends Map<Id64String, Override> {
  // This is required for mock framework used by ui libraries, which otherwise try to clone this as a standard Map.
  public override get [Symbol.toStringTag]() { return "OverridesMap"; }

  public constructor(
    private readonly _json: DisplayStyleSettingsProps,
    private readonly _arrayKey: OverridesArrayKey,
    private readonly _event: BeEvent<(id: Id64String, ovr: Override | undefined) => void>,
    private readonly _idFromProps: (props: OverrideProps) => Id64String | undefined,
    private readonly _overrideToProps: (ovr: Override, id: Id64String) => OverrideProps,
    private readonly _overrideFromProps: (props: OverrideProps) => Override | undefined) {
    super();
    this.populate();
  }

  public override set(id: Id64String, override: Override): this {
    this._event.raiseEvent(id, override);
    super.set(id, override);

    const index = this.findOrAllocateIndex(id);
    const array = this._array;
    assert(undefined !== array);
    array[index] = this._overrideToProps(override, id);

    return this;
  }

  public override delete(id: Id64String): boolean {
    this._event.raiseEvent(id, undefined);
    if (!super.delete(id))
      return false;

    const index = this.findExistingIndex(id);
    if (undefined !== index) {
      assert(undefined !== this._array);
      this._array.splice(index, 1);
    }

    return true;
  }

  public override clear(): void {
    for (const id of this.keys())
      this.delete(id);

    this._json[this._arrayKey] = undefined;
  }

  public populate(): void {
    super.clear();

    const ovrs = this._array;
    if (!ovrs)
      return;

    for (const props of ovrs) {
      const id = this._idFromProps(props);
      if (undefined !== id && Id64.isValidId64(id)) {
        const ovr = this._overrideFromProps(props);
        if (ovr)
          super.set(id, ovr);
      }
    }
  }

  private get _array(): OverrideProps[] | undefined {
    return JsonUtils.asArray(this._json[this._arrayKey]);
  }

  private findOrAllocateIndex(id: Id64String): number {
    const index = this.findExistingIndex(id);
    if (undefined !== index)
      return index;

    let ovrs = this._array;
    if (!ovrs)
      ovrs = this._json[this._arrayKey] = [];

    return ovrs.length;
  }

  private findExistingIndex(id: Id64String): number | undefined {
    const ovrs = this._array;
    if (!ovrs)
      return undefined;

    for (let i = 0; i < ovrs.length; i++)
      if (this._idFromProps(ovrs[i]) === id)
        return i;

    return undefined;
  }
}

/** Options supplied when constructing a [[DisplayStyleSettings]].
 * @public
 * @extensions
 */
export interface DisplayStyleSettingsOptions {
  /** A function that instantiates a [[ContextRealityModel]] to be stored in [[DisplayStyleSettings.contextRealityModels]]. */
  createContextRealityModel?: (props: ContextRealityModelProps) => ContextRealityModel;
  /** If true, the caller will populate contextRealityModels after construction.
   * @internal used by DisplayStyleState constructor.
   */
  deferContextRealityModels?: boolean;
}

/** Provides access to the settings defined by a [[DisplayStyle]] or [[DisplayStyleState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @see [[DisplayStyleSettingsProps]] for the JSON representation of these settings.
 * @public
 */
export class DisplayStyleSettings {
  protected readonly _json: DisplayStyleSettingsProps;
  private _viewFlags: ViewFlags;
  private _background: ColorDef;
  private _monochrome: ColorDef;
  private _monochromeMode: MonochromeMode;
  private readonly _subCategoryOverrides: OverridesMap<DisplayStyleSubCategoryProps, SubCategoryOverride>;
  private readonly _modelAppearanceOverrides: OverridesMap<DisplayStyleModelAppearanceProps, FeatureAppearance>;
  private readonly _realityModelDisplaySettings: OverridesMap<DisplayStyleRealityModelDisplayProps, RealityModelDisplaySettings>;
  private readonly _planarClipMasks: OverridesMap<DisplayStylePlanarClipMaskProps, PlanarClipMaskSettings>;
  private readonly _excludedElements: ExcludedElements;
  private _backgroundMap: BackgroundMapSettings;
  private _mapImagery: MapImagerySettings;
  private _analysisStyle?: AnalysisStyle;
  private _clipStyle: ClipStyle;
  private readonly _contextRealityModels: ContextRealityModels;
  private _whiteOnWhiteReversal: WhiteOnWhiteReversalSettings;

  /** Returns true if this is a [[DisplayStyle3dSettings]]. */
  public is3d(): this is DisplayStyle3dSettings {
    return false;
  }

  /** Planar clip masks to be applied to persistent reality models (@see [SpatialModelState.isRealityModel]($frontend).
   * The key for each entry is the Id of the model to which the mask settings apply.
   */
  public get planarClipMasks(): Map<Id64String, PlanarClipMaskSettings> {
    return this._planarClipMasks;
  }

  /** Reality models to be displayed in the view. */
  public get contextRealityModels(): ContextRealityModels {
    return this._contextRealityModels;
  }

  /** Event raised by [[applyOverrides]] just before the overrides are applied. */
  public readonly onApplyOverrides = new BeEvent<(overrides: Readonly<DisplayStyleSettingsProps>) => void>();
  /** Event raised by [[applyOverrides]] after the overrides are applied. */
  public readonly onOverridesApplied = new BeEvent<(overrides: Readonly<DisplayStyleSettingsProps>) => void>();
  /** Event raised just prior to assignment to the [[viewFlags]] property. */
  public readonly onViewFlagsChanged = new BeEvent<(newFlags: Readonly<ViewFlags>) => void>();
  /** Event raised just prior to assignment to the [[backgroundColor]] property. */
  public readonly onBackgroundColorChanged = new BeEvent<(newColor: ColorDef) => void>();
  /** Event raised just prior to assignment to the [[monochromeColor]] property. */
  public readonly onMonochromeColorChanged = new BeEvent<(newColor: ColorDef) => void>();
  /** Event raised just prior to assignment to the [[monochromeMode]] property. */
  public readonly onMonochromeModeChanged = new BeEvent<(newMode: MonochromeMode) => void>();
  /** Event raised just prior to assignment to the [[backgroundMap]] property. */
  public readonly onBackgroundMapChanged = new BeEvent<(newMap: BackgroundMapSettings) => void>();
  /** Event raised just prior to assignment to the [[mapImagery]] property.
   * @beta
   */
  public readonly onMapImageryChanged = new BeEvent<(newImagery: Readonly<MapImagerySettings>) => void>();
  /** Event raised just prior to assignment to the `scheduleScriptProps` property.
   * @see [[onRenderTimelineChanged]] to be notified when the [[renderTimeline]] property from which a script can be obtained is changed.
   */
  public readonly onScheduleScriptPropsChanged = new BeEvent<(newProps: Readonly<RenderSchedule.ScriptProps> | undefined) => void>();

  /** Event raised just prior to assignment to the [[renderTimeline]] property. */
  public readonly onRenderTimelineChanged = new BeEvent<(newRenderTimeline: Id64String | undefined) => void>();
  /** Event raised just prior to assignment to the [[timePoint]] property. */
  public readonly onTimePointChanged = new BeEvent<(newTimePoint: number | undefined) => void>();
  /** Event raised just prior to assignment to the [[analysisStyle]] property. */
  public readonly onAnalysisStyleChanged = new BeEvent<(newStyle: Readonly<AnalysisStyle> | undefined) => void>();
  /** Event raised just prior to assignment to the [[analysisFraction]] property. */
  public readonly onAnalysisFractionChanged = new BeEvent<(newFraction: number) => void>();
  /** Event raised when the contents of [[excludedElementIds]] changes. */
  public readonly onExcludedElementsChanged = new BeEvent<() => void>();
  /** Event raised just prior to assignment to the [[clipStyle]] property. */
  public readonly onClipStyleChanged = new BeEvent<(newStyle: ClipStyle) => void>();
  /** Event raised when the [[SubCategoryOverride]]s change. */
  public readonly onSubCategoryOverridesChanged = new BeEvent<(subCategoryId: Id64String, newOverrides: SubCategoryOverride | undefined) => void>();
  /** Event raised just before changing the appearance override for a model. */
  public readonly onModelAppearanceOverrideChanged = new BeEvent<(modelId: Id64String, newAppearance: FeatureAppearance | undefined) => void>();
  /** Event raised just before [[setRealityModelDisplaySettings]] changes the display settings for a reality model.
   * @beta
   */
  public readonly onRealityModelDisplaySettingsChanged = new BeEvent<(modelId: Id64String, newSettings: RealityModelDisplaySettings | undefined) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.thematic]] property. */
  public readonly onThematicChanged = new BeEvent<(newThematic: ThematicDisplay) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.contours]] property. */
  public readonly onContoursChanged = new BeEvent<(newContours: ContourDisplay) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.hiddenLineSettings]] property. */
  public readonly onHiddenLineSettingsChanged = new BeEvent<(newSettings: HiddenLine.Settings) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.ambientOcclusionSettings]] property. */
  public readonly onAmbientOcclusionSettingsChanged = new BeEvent<(newSettings: AmbientOcclusion.Settings) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.solarShadows]] property. */
  public readonly onSolarShadowsChanged = new BeEvent<(newSettings: SolarShadowSettings) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.environment]] property. */
  public readonly onEnvironmentChanged = new BeEvent<(newEnv: Readonly<Environment>) => void>();
  /** Event raised just prior to assignment to the [[DisplayStyle3dSettings.lights]] property. */
  public readonly onLightsChanged = new BeEvent<(newLights: LightSettings) => void>();
  /** Event raised just before changing the plan projection settings for a model. */
  public readonly onPlanProjectionSettingsChanged = new BeEvent<(modelId: Id64String, newSettings: PlanProjectionSettings | undefined) => void>();
  /** Event raised just before adding or removing an entry from [[planarClipMasks]]. */
  public readonly onPlanarClipMaskChanged = new BeEvent<(modelId: Id64String, newSettings: PlanarClipMaskSettings | undefined) => void>();
  /** Event raised just prior to assignment to the [[whiteOnWhiteReversal]] property. */
  public readonly onWhiteOnWhiteReversalChanged = new BeEvent<(newSettings: WhiteOnWhiteReversalSettings) => void>();

  /** Construct a new DisplayStyleSettings from an [[ElementProps.jsonProperties]].
   * @param jsonProperties An object with an optional `styles` property containing a display style's settings.
   * @param options Options for customizing the display style settings.
   * @note When the `DisplayStyleSetting`'s properties are modified by public setters, the `jsonProperties`'s `styles` object will be updated to reflect the change.
   * @note If `jsonProperties` contains no `styles` member, one will be added as an empty object.
   * @note Generally there is no reason to create an object of this type directly; a [[DisplayStyle]] or [[DisplayStyleState]] constructs one as part of its own construction.
   */
  public constructor(jsonProperties: { styles?: DisplayStyleSettingsProps }, options?: DisplayStyleSettingsOptions) {
    if (undefined === jsonProperties.styles)
      jsonProperties.styles = {};

    this._json = jsonProperties.styles;
    this._viewFlags = ViewFlags.fromJSON(this._json.viewflags);
    this._background = ColorDef.fromJSON(this._json.backgroundColor);

    this._monochrome = undefined !== this._json.monochromeColor ? ColorDef.fromJSON(this._json.monochromeColor) : ColorDef.white;
    this._monochromeMode = MonochromeMode.Flat === this._json.monochromeMode ? MonochromeMode.Flat : MonochromeMode.Scaled;

    this._backgroundMap = BackgroundMapSettings.fromPersistentJSON(this._json.backgroundMap);
    this._mapImagery = MapImagerySettings.createFromJSON(this._json.mapImagery, this._json.backgroundMap);

    // Ensure that if we used the deprecated imagery properties from this._backgroundMap to set up the base layer of this._mapImagery,
    // we update our JSON to include that base layer.
    this._json.mapImagery = this._mapImagery.toJSON();

    this._excludedElements = new ExcludedElements(this._json);

    if (this._json.analysisStyle)
      this._analysisStyle = AnalysisStyle.fromJSON(this._json.analysisStyle);

    this._whiteOnWhiteReversal = WhiteOnWhiteReversalSettings.fromJSON(this._json.whiteOnWhiteReversal);
    this._clipStyle = ClipStyle.fromJSON(this._json.clipStyle);

    this._subCategoryOverrides = new OverridesMap<DisplayStyleSubCategoryProps, SubCategoryOverride>(this._json, "subCategoryOvr", this.onSubCategoryOverridesChanged,
      (props) => props.subCategory,
      (ovr, subCategory) => { return { ...ovr.toJSON(), subCategory }; },
      (props) => {
        const ovr = SubCategoryOverride.fromJSON(props);
        return ovr.anyOverridden ? ovr : undefined;
      });

    this._modelAppearanceOverrides = new OverridesMap<DisplayStyleModelAppearanceProps, FeatureAppearance>(this._json, "modelOvr", this.onModelAppearanceOverrideChanged,
      (props) => props.modelId,
      (ovr, modelId) => { return { ...ovr.toJSON(), modelId }; },
      (props) => {
        const app = FeatureAppearance.fromJSON(props);
        return app.anyOverridden ? app : undefined;
      });

    this._realityModelDisplaySettings = new OverridesMap<DisplayStyleRealityModelDisplayProps, RealityModelDisplaySettings>(this._json, "realityModelDisplay", this.onRealityModelDisplaySettingsChanged,
      (props) => props.modelId,
      (settings, modelId) => { return { ...settings.toJSON(), modelId }; },
      (props) => RealityModelDisplaySettings.fromJSON(props),
    );

    this._planarClipMasks = new OverridesMap<DisplayStylePlanarClipMaskProps, PlanarClipMaskSettings>(this._json, "planarClipOvr", this.onPlanarClipMaskChanged,
      (props) => props.modelId,
      (ovr, modelId) => { return { ...ovr.toJSON(), modelId }; },
      (props) => {
        const settings = PlanarClipMaskSettings.fromJSON(props);
        return settings.isValid ? settings : undefined;
      });

    this._contextRealityModels = new ContextRealityModels({
      container: this._json,
      createContextRealityModel: options?.createContextRealityModel,
      deferPopulating: options?.deferContextRealityModels,
    });
  }

  /** Flags controlling various aspects of the display style. */
  public get viewFlags(): ViewFlags { return this._viewFlags; }
  public set viewFlags(flags: ViewFlags) {
    if (this.viewFlags.equals(flags))
      return;

    this.onViewFlagsChanged.raiseEvent(flags);
    this._viewFlags = flags;
    this._json.viewflags = flags.toJSON();
  }

  /** The color displayed in the view background - by default, [[ColorDef.black]]. */
  public get backgroundColor(): ColorDef { return this._background; }
  public set backgroundColor(color: ColorDef) {
    if (this.backgroundColor.equals(color))
      return;

    this.onBackgroundColorChanged.raiseEvent(color);
    this._background = color;
    this._json.backgroundColor = color.toJSON();
  }

  /** The color used to draw geometry when [[ViewFlags.monochrome]] is enabled - by default, [[ColorDef.white]].
   * The monochrome color is applied to all surfaces and linear geometry, but only applied to the **edges** of surfaces in [[RenderMode.Wireframe]].
   * @see [[monochromeMode]] to control how the color is applied.
   */
  public get monochromeColor(): ColorDef { return this._monochrome; }
  public set monochromeColor(color: ColorDef) {
    if (this.monochromeColor.equals(color))
      return;

    this.onMonochromeColorChanged.raiseEvent(color);
    this._monochrome = color;
    this._json.monochromeColor = color.toJSON();
  }

  /** The style in which [[monochromeColor]] is applied when [[ViewFlags.monochrome]] is enabled - by default, [[MonochromeMode.Scaled]]. */
  public get monochromeMode(): MonochromeMode { return this._monochromeMode; }
  public set monochromeMode(mode: MonochromeMode) {
    if (this.monochromeMode === mode)
      return;

    this.onMonochromeModeChanged.raiseEvent(mode);
    this._monochromeMode = mode;
    this._json.monochromeMode = mode;
  }

  /** Settings controlling display of the background map within views of geolocated models. */
  public get backgroundMap(): BackgroundMapSettings { return this._backgroundMap; }

  public set backgroundMap(map: BackgroundMapSettings) {
    if (!this.backgroundMap.equals(map)) {
      this.onBackgroundMapChanged.raiseEvent(map);
      this._backgroundMap = map; // it's an immutable type.
      this._json.backgroundMap = map.toPersistentJSON();
    }
  }

  /** Settings defining the map imagery layers to be displayed within the view.
   * @beta
   */
  public get mapImagery(): MapImagerySettings { return this._mapImagery; }

  public set mapImagery(mapImagery: MapImagerySettings) {
    this.onMapImageryChanged.raiseEvent(mapImagery);
    this._mapImagery = mapImagery;
    this._json.mapImagery = this._mapImagery.toJSON();
  }

  /** @internal
   * Handles keeping the map imagery layers in synch after changes have been made (used internally only by front end)
   */
  public synchMapImagery() {
    this.onMapImageryChanged.raiseEvent(this._mapImagery);
    this._json.mapImagery = this._mapImagery.toJSON();
  }

  /** The Id of a [RenderTimeline]($backend) element containing a [[RenderSchedule.Script]] used to animate the view.
   * If [[scheduleScriptProps]] is defined, it takes precedence over the script supplied by the RenderTimeline.
   * @note If this [[DisplayStyleSettings]] is associated with a [DisplayStyleState]($frontend), assigning to [[renderTimeline]] will enqueue asynchronous loading of
   * the script from the [RenderTimeline]($backend) element; for more readable code, prefer instead to `await` [DisplayStyleState.changeRenderTimeline]($frontend).
   * @see [[onRenderTimelineChanged]] to be notified of changes to this property.
   */
  public get renderTimeline(): Id64String | undefined {
    return this._json.renderTimeline;
  }
  public set renderTimeline(id: Id64String | undefined) {
    if (id !== this.renderTimeline) {
      this.onRenderTimelineChanged.raiseEvent(id);
      this._json.renderTimeline = id;
    }
  }

  /** JSON representation of a [[RenderSchedule.Script]] embedded in the display style describing how to animate the contents of the view over time.
   * This script, if present, takes precedence over a script supplied by [[renderTimeline]].
   * @see [[onScheduleScriptPropsChanged]] to be notified when this property changes.
   * @see [DisplayStyleState.scheduleScript]($frontend) to change the [[RenderSchedule.Script]] object directly rather than via JSON.
   */
  public get scheduleScriptProps(): RenderSchedule.ScriptProps | undefined {
    return this._json.scheduleScript;
  }
  public set scheduleScriptProps(props: RenderSchedule.ScriptProps | undefined) {
    this.onScheduleScriptPropsChanged.raiseEvent(props);
    this._json.scheduleScript = props;
  }

  /** The point in time currently reflected by the view, expressed in seconds in the [Unix epoch](https://en.wikipedia.org/wiki/Unix_time).
   * This identifies a point on the timeline of the style's [[RenderSchedule.Script]], if any; it may also affect display of four-dimensional reality models.
   * @see [[onTimePointChanged]] to be notified of changes to this property.
   */
  public get timePoint(): number | undefined {
    return this._json.timePoint;
  }
  public set timePoint(timePoint: number | undefined) {
    if (timePoint !== this.timePoint) {
      this.onTimePointChanged.raiseEvent(timePoint);
      this._json.timePoint = timePoint;
    }
  }

  /** Settings controlling the display of analytical models.
   * @see [[analysisFraction]] to control playback of the animation.
   */
  public get analysisStyle(): AnalysisStyle | undefined { return this._analysisStyle; }
  public set analysisStyle(style: AnalysisStyle | undefined) {
    if (style === this.analysisStyle)
      return;

    this.onAnalysisStyleChanged.raiseEvent(style);
    this._analysisStyle = style;
    if (style)
      this._json.analysisStyle = style.toJSON();
    else
      delete this._json.analysisStyle;
  }

  /** A floating point value in [0..1] indicating the current point in animation of the [[analysisStyle]], where 0 corresponds to the beginning of
   * the animation and 1 to the end. Default: 0.0.
   */
  public get analysisFraction(): number {
    const fraction = this._json.analysisFraction ?? 0;
    return Math.max(0, Math.min(1, fraction));
  }
  public set analysisFraction(fraction: number) {
    if (this.analysisFraction === fraction)
      return;

    this.onAnalysisFractionChanged.raiseEvent(fraction);
    this._json.analysisFraction = Math.max(0, Math.min(1, fraction));
  }

  /** Settings controlling how white-on-white reversal is applied when [[ViewFlags.whiteOnWhiteReversal]] is enabled. */
  public get whiteOnWhiteReversal(): WhiteOnWhiteReversalSettings { return this._whiteOnWhiteReversal; }
  public set whiteOnWhiteReversal(settings: WhiteOnWhiteReversalSettings) {
    if (settings.equals(this.whiteOnWhiteReversal))
      return;

    this.onWhiteOnWhiteReversalChanged.raiseEvent(settings);
    this._whiteOnWhiteReversal = settings;
    const json = settings.toJSON();
    if (json)
      this._json.whiteOnWhiteReversal = json;
    else
      delete this._json.whiteOnWhiteReversal;
  }

  /** Customize the way geometry belonging to a [[SubCategory]] is drawn by this display style.
   * @param id The Id of the SubCategory whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [[SubCategoryAppearance]].
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void {
    this.subCategoryOverrides.set(id, ovr);
  }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The Id of the [[SubCategory]].
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String): void {
    this.subCategoryOverrides.delete(id);
  }

  /** The overrides applied by this style. */
  public get subCategoryOverrides(): Map<Id64String, SubCategoryOverride> {
    return this._subCategoryOverrides;
  }

  /** Obtain the override applied to a [[SubCategoryAppearance]] by this style.
   * @param id The Id of the [[SubCategory]].
   * @returns The corresponding SubCategoryOverride, or undefined if the SubCategory's appearance is not overridden.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined {
    return this.subCategoryOverrides.get(id);
  }

  /** Returns true if an [[SubCategoryOverride]]s are defined by this style. */
  public get hasSubCategoryOverride(): boolean {
    return this.subCategoryOverrides.size > 0;
  }

  /** Customize the way a [Model]($backend)   is drawn by this display style.
   * @param modelId The Id of the [Model]($backend)  whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [Model]($backend) .
   * @see [[dropModelAppearanceOverride]]
   */
  public overrideModelAppearance(modelId: Id64String, ovr: FeatureAppearance): void {
    this.modelAppearanceOverrides.set(modelId, ovr);
  }

  /** Remove any appearance overrides applied to a [Model]($backend)  by this style.
   * @param modelId The Id of the [Model]($backend) .
   * @param ovr The overrides to apply to the [Model]($backend) .
   * @see [[overrideModelAppearance]]
   */
  public dropModelAppearanceOverride(id: Id64String): void {
    this.modelAppearanceOverrides.delete(id);
  }

  /** The overrides applied by this style. */
  public get modelAppearanceOverrides(): Map<Id64String, FeatureAppearance> {
    return this._modelAppearanceOverrides;
  }

  /** Obtain the override applied to a [Model]($backend)  by this style.
   * @param id The Id of the [Model]($backend).
   * @returns The corresponding FeatureAppearance, or undefined if the Model's appearance is not overridden.
   * @see [[overrideModelAppearance]]
   */
  public getModelAppearanceOverride(id: Id64String): FeatureAppearance | undefined {
    return this.modelAppearanceOverrides.get(id);
  }

  /** Returns true if model appearance overrides are defined by this style. */
  public get hasModelAppearanceOverride(): boolean {
    return this.modelAppearanceOverrides.size > 0;
  }

  /** Get any settings that override how the reality model with the specified Id is displayed.
   * @param modelId The Id of the [Model]($backend).
   * @returns the display settings, or `undefined` if no settings have been associated with `modelId`.
   * @see [[setRealityModelDisplaySettings]] to change the settings.
   * @beta
   */
  public getRealityModelDisplaySettings(modelId: Id64String): RealityModelDisplaySettings | undefined {
    return this._realityModelDisplaySettings.get(modelId);
  }

  /** Change the settings that control how the reality model with the specified Id is displayed.
   * @param modelId The Id of the [Model]($backend) to which the settings apply.
   * @param settings The settings to apply to the model, or `undefined` to clear any previous settings for that model.
   * @beta
   */
  public setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined): void {
    if (settings)
      this._realityModelDisplaySettings.set(modelId, settings);
    else
      this._realityModelDisplaySettings.delete(modelId);
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
   * @param id The Ids of the element(s) to be excluded.
   */
  public addExcludedElements(id: Id64String | Iterable<Id64String>) {
    this._excludedElements.add("string" === typeof id ? [id] : id);
    this.onExcludedElementsChanged.raiseEvent();
  }

  /** Remove an element from the set of elements not to be displayed. */
  public dropExcludedElement(id: Id64String): void {
    this._excludedElements.delete([id]);
    this.onExcludedElementsChanged.raiseEvent();
  }

  /** Remove one or more elements from the set of elements not to be displayed.
   * @param id The Ids of the element(s) to be removed from the set of excluded elements.
   */
  public dropExcludedElements(id: Id64String | Iterable<Id64String>) {
    this._excludedElements.delete("string" === typeof id ? [id] : id);
    this.onExcludedElementsChanged.raiseEvent();
  }

  /** Remove all elements from the set of elements not to be displayed. */
  public clearExcludedElements(): void {
    this._excludedElements.reset(undefined);
    this.onExcludedElementsChanged.raiseEvent();
  }

  /** The style applied to the view's [ClipVector]($core-geometry). */
  public get clipStyle(): ClipStyle {
    return this._clipStyle;
  }
  public set clipStyle(style: ClipStyle) {
    this.onClipStyleChanged.raiseEvent(style);
    this._clipStyle = style;
    if (style.matchesDefaults)
      delete this._json.clipStyle;
    else
      this._json.clipStyle = style.toJSON();
  }

  /** Convert these settings to their JSON representation. */
  public toJSON(): DisplayStyleSettingsProps {
    return this._json;
  }

  /** Serialize a subset of these settings to JSON, such that they can be applied to another DisplayStyleSettings to selectively override those settings.
   * @param options Specifies which settings should be serialized. By default, settings that are specific to an iModel (e.g., subcategory overrides) or iTwin (e.g., context reality models)
   * are omitted, as are drawing aids (e.g., ACS triad and grid).
   * @returns a JSON representation of the selected settings suitable for passing to [[applyOverrides]].
   * @see [[applyOverrides]] to apply the overrides to another DisplayStyleSettings..
   */
  public toOverrides(options?: DisplayStyleOverridesOptions): DisplayStyleSettingsProps {
    if (options?.includeAll) {
      return {
        ...this.toJSON(),
        viewflags: this.viewFlags.toFullyDefinedJSON(),
      };
    }

    const viewflags: Partial<ViewFlagProps> = this.viewFlags.toFullyDefinedJSON();
    const props: DisplayStyleSettingsProps = {
      viewflags,
      backgroundColor: this.backgroundColor.toJSON(),
      monochromeColor: this.monochromeColor.toJSON(),
      monochromeMode: this.monochromeMode,
      whiteOnWhiteReversal: this.whiteOnWhiteReversal.toJSON() ?? { ignoreBackgroundColor: false },
    };

    if (options?.includeBackgroundMap) {
      props.backgroundMap = this.backgroundMap.toPersistentJSON();
      props.mapImagery = this.mapImagery.toJSON();
    } else {
      delete viewflags.backgroundMap;
    }

    if (!options?.includeDrawingAids) {
      delete viewflags.acs;
      delete viewflags.grid;
    }

    if (options?.includeITwinSpecific || options?.includeIModelSpecific) {
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

      if (this.renderTimeline)
        props.renderTimeline = this.renderTimeline;

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
   */
  public applyOverrides(overrides: DisplayStyleSettingsProps): void {
    this._applyOverrides(overrides);
    this.onOverridesApplied.raiseEvent(overrides);
  }

  /** @internal */
  protected _applyOverrides(overrides: DisplayStyleSettingsProps): void {
    this.onApplyOverrides.raiseEvent(overrides);

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
      this.backgroundMap = BackgroundMapSettings.fromPersistentJSON(overrides.backgroundMap);

    if (overrides.mapImagery)
      this.mapImagery = MapImagerySettings.createFromJSON(overrides.mapImagery, this.backgroundMap.toPersistentJSON());

    if (undefined !== overrides.timePoint)
      this.timePoint = overrides.timePoint;

    if (overrides.contextRealityModels) {
      this.contextRealityModels.clear();
      for (const props of overrides.contextRealityModels)
        this.contextRealityModels.add(props);
    }

    if (overrides.analysisStyle)
      this.analysisStyle = AnalysisStyle.fromJSON(overrides.analysisStyle);

    if (overrides.whiteOnWhiteReversal)
      this.whiteOnWhiteReversal = WhiteOnWhiteReversalSettings.fromJSON(overrides.whiteOnWhiteReversal);

    if (undefined !== overrides.analysisFraction)
      this.analysisFraction = overrides.analysisFraction;

    if (overrides.scheduleScript)
      this.scheduleScriptProps = [...overrides.scheduleScript];

    if (overrides.renderTimeline)
      this.renderTimeline = overrides.renderTimeline;

    if (overrides.subCategoryOvr) {
      this._json.subCategoryOvr = [...overrides.subCategoryOvr];
      this._subCategoryOverrides.populate();
    }

    if (overrides.modelOvr) {
      this._json.modelOvr = [...overrides.modelOvr];
      this._modelAppearanceOverrides.populate();
    }

    if (overrides.realityModelDisplay) {
      this._json.realityModelDisplay = [...overrides.realityModelDisplay];
      this._realityModelDisplaySettings.populate();
    }

    if (overrides.excludedElements)
      this._excludedElements.reset("string" === typeof overrides.excludedElements ? overrides.excludedElements : [...overrides.excludedElements]);

    this.onOverridesApplied.raiseEvent(overrides);
  }
}

/** Provides access to the settings defined by a [[DisplayStyle3d]] or [[DisplayStyle3dState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @public
 */
export class DisplayStyle3dSettings extends DisplayStyleSettings {
  private _thematic: ThematicDisplay;
  private _contours: ContourDisplay;
  private _hline: HiddenLine.Settings;
  private _ao: AmbientOcclusion.Settings;
  private _solarShadows: SolarShadowSettings;
  private _lights: LightSettings;
  private _environment: Environment;
  private _planProjections?: Map<string, PlanProjectionSettings>;

  private get _json3d(): DisplayStyle3dSettingsProps { return this._json as DisplayStyle3dSettingsProps; }

  public override is3d(): this is DisplayStyle3dSettings {
    return true;
  }

  public constructor(jsonProperties: { styles?: DisplayStyle3dSettingsProps }, options?: DisplayStyleSettingsOptions) {
    super(jsonProperties, options);
    this._thematic = ThematicDisplay.fromJSON(this._json3d.thematic);
    this._contours = ContourDisplay.fromJSON(this._json3d.contours);
    this._hline = HiddenLine.Settings.fromJSON(this._json3d.hline);
    this._ao = AmbientOcclusion.Settings.fromJSON(this._json3d.ao);
    this._solarShadows = SolarShadowSettings.fromJSON(this._json3d.solarShadows);
    this._environment = Environment.fromJSON(this._json3d.environment);

    // Very long ago we used to stick MicroStation's light settings into json.sceneLights. Later we started adding the sunDir.
    // We don't want any of MicroStation's settings. We do want to preserve the sunDir if present.
    if (this._json3d.lights) {
      this._lights = LightSettings.fromJSON(this._json3d.lights);
    } else {
      const sunDir = this._json3d.sceneLights?.sunDir;
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

  /** Convert these settings to their JSON representation. */
  public override toJSON(): DisplayStyle3dSettingsProps {
    return this._json3d;
  }

  /** See [[DisplayStyleSettings.toOverrides]]. */
  public override toOverrides(options?: DisplayStyleOverridesOptions): DisplayStyle3dSettingsProps {
    const props = super.toOverrides(options) as DisplayStyle3dSettingsProps;
    if (options?.includeAll)
      return props;

    assert(undefined !== props.viewflags);

    props.environment = this.environment.toJSON();
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

    props.contours = this.contours.toJSON();

    return props;
  }

  /** See [[DisplayStyleSettings.applyOverrides]]. */
  public override applyOverrides(overrides: DisplayStyle3dSettingsProps): void {
    super._applyOverrides(overrides);

    if (overrides.environment)
      this.environment = Environment.fromJSON(overrides.environment);

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

    if (overrides.contours)
      this.contours = ContourDisplay.fromJSON(overrides.contours);

    this.onOverridesApplied.raiseEvent(overrides);
  }

  /** The settings that control thematic display. */
  public get thematic(): ThematicDisplay { return this._thematic; }
  public set thematic(thematic: ThematicDisplay) {
    if (thematic.equals(this.thematic))
      return;

    this.onThematicChanged.raiseEvent(thematic);
    this._thematic = thematic;
    this._json3d.thematic = thematic.toJSON();
  }

  /** The settings that control contour display. */
  public get contours(): ContourDisplay { return this._contours; }
  public set contours(contours: ContourDisplay) {
    if (contours.equals(this.contours))
      return;

    this.onContoursChanged.raiseEvent(contours);
    this._contours = contours;
    this._json3d.contours = contours.toJSON();
  }

  /** The settings that control how visible and hidden edges are displayed.  */
  public get hiddenLineSettings(): HiddenLine.Settings { return this._hline; }
  public set hiddenLineSettings(hline: HiddenLine.Settings) {
    if (hline.equals(this.hiddenLineSettings))
      return;

    this.onHiddenLineSettingsChanged.raiseEvent(hline);
    this._hline = hline;
    this._json3d.hline = hline.toJSON();
  }

  /** The settings that control how ambient occlusion is displayed. */
  public get ambientOcclusionSettings(): AmbientOcclusion.Settings { return this._ao; }
  public set ambientOcclusionSettings(ao: AmbientOcclusion.Settings) {
    this.onAmbientOcclusionSettingsChanged.raiseEvent(ao);
    this._ao = ao;
    this._json3d.ao = ao.toJSON();
  }

  /** The settings that control how solar shadows are displayed. */
  public get solarShadows(): SolarShadowSettings {
    return this._solarShadows;
  }
  public set solarShadows(solarShadows: SolarShadowSettings) {
    if (solarShadows.equals(this.solarShadows))
      return;

    this.onSolarShadowsChanged.raiseEvent(solarShadows);
    this._solarShadows = solarShadows;
    const json = solarShadows.toJSON();
    if (!json)
      delete this._json3d.solarShadows;
    else
      this._json3d.solarShadows = json;
  }

  /** Controls the display of a [[SkyBox]], [[GroundPlane]], and [[Atmosphere]].
   * @public
   */
  public get environment(): Environment {
    return this._environment;
  }
  public set environment(environment: Environment) {
    if (environment !== this.environment) {
      this.onEnvironmentChanged.raiseEvent(environment);
      this._environment = environment;
      this._json3d.environment = environment.toJSON();
    }
  }

  /** Toggle display of the [[environment]]'s [[SkyBox]].
   * @param display Whether to display the skybox, or `undefined` to toggle the current display.
   */
  public toggleSkyBox(display?: boolean): void {
    display = display ?? this.environment.displaySky;
    if (display !== this.environment.displaySky)
      this.environment = this.environment.withDisplay({ sky: display });
  }

  /** Toggle display of the [[environment]]'s [[GroundPlane]].
   * @param display Whether to display the ground plane, or `undefined` to toggle the current display.
   */
  public toggleGroundPlane(display?: boolean): void {
    display = display ?? this.environment.displayGround;
    if (display !== this.environment.displayGround)
      this.environment = this.environment.withDisplay({ ground: display });
  }

  /** Toggle display of the [[environment]]'s [[Atmosphere]].
   * @beta
   * @param display Whether to display the atmosphere, or `undefined` to toggle the current display.
   */
  public toggleAtmosphere(display?: boolean): void {
    display = display ?? this.environment.displayAtmosphere;
    if (display !== this.environment.displayAtmosphere)
      this.environment = this.environment.withDisplay({ atmosphere: display });
  }

  public get lights(): LightSettings {
    return this._lights;
  }
  public set lights(lights: LightSettings) {
    if (this.lights.equals(lights))
      return;

    this.onLightsChanged.raiseEvent(lights);
    this._lights = lights;
    this._json3d.lights = lights.toJSON();
  }

  /** Adjust the solar light direction based on a date and time at a geographic location.
   * This replaces `this.lights` with a copy that records the time point and the computed direction.
   * @param timePoint The time in UNIX milliseconds.
   * @param location The geographic location; or an iModel, in which case the iModel's [[EcefLocation]] is used.
   * @see [[sunTime]] to get the current sun time.
   * @see [[clearSunTime]] to clear the time point.
   * @note If `location` is an iModel lacking an EcefLocation, a location in Exton, Pennsylvania will be used to compute the light direction instead.
   */
  public setSunTime(timePoint: number, location: IModel | Cartographic): void {
    let cartoCenter;
    if (location instanceof IModel) {
      if (location.ecefLocation)
        cartoCenter = Cartographic.fromEcef(location.ecefLocation.origin);

      if (!cartoCenter)
        cartoCenter = Cartographic.fromDegrees({ longitude: -75.17035, latitude: 39.954927, height: 0.0 });
    } else {
      cartoCenter = location;
    }

    const direction = calculateSolarDirection(new Date(timePoint), cartoCenter);
    this.lights = this.lights.clone({ solar: { direction, timePoint } });
  }

  /** Clear the solar time point stored in `this.lights.solarLight`.
   * @note This does not affect the solar light direction.
   * @see [[sunTime]] to get the current sun time.
   * @see [[setSunTime]] to set the time point and the solar light direction derived from it.
   */
  public clearSunTime(): void {
    if (this.lights.solar.timePoint === undefined)
      return;

    const solar = this.lights.solar.toJSON() ?? {};
    solar.timePoint = undefined;
    this.lights = this.lights.clone({ solar });
  }

  /** The time point from which the solar light direction was derived, in UNIX milliseconds.
   * @see [[setSunTime]] to change the time point and solar direction.
   * @see [[clearSunTime]] to reset the time point to `undefined`.
   */
  public get sunTime(): number | undefined {
    return this.lights.solar.timePoint;
  }

  /** Get the plan projection settings associated with the specified model, if defined. */
  public getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined {
    return undefined !== this._planProjections ? this._planProjections.get(modelId) : undefined;
  }

  /** Set or clear the plan projection settings associated with the specified model. */
  public setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined): void {
    this.onPlanProjectionSettingsChanged.raiseEvent(modelId, settings);

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

  /** An iterator over all of the defined plan projection settings. The iterator includes the Id of the model associated with each settings object. */
  public get planProjectionSettings(): Iterable<[Id64String, PlanProjectionSettings]> | undefined {
    return undefined !== this._planProjections ? this._planProjections.entries() : undefined;
  }
}
