/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import {
  assert,
  Id64,
  Id64String,
  JsonUtils,
} from "@bentley/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core";
import { HiddenLine } from "./HiddenLine";
import { AmbientOcclusion } from "./AmbientOcclusion";
import {
  SolarShadowSettings,
  SolarShadowSettingsProps,
} from "./SolarShadows";
import { DefinitionElementProps } from "./ElementProps";
import {
  ViewFlagProps,
  ViewFlags,
} from "./ViewFlags";
import { SubCategoryAppearance } from "./SubCategoryAppearance";
import { SubCategoryOverride } from "./SubCategoryOverride";
import { GroundPlaneProps } from "./GroundPlane";
import { SkyBoxProps } from "./SkyBox";
import {
  ColorDef,
  ColorDefProps,
} from "./ColorDef";
import {
  AnalysisStyle,
  AnalysisStyleProps,
} from "./AnalysisStyle";
import { RenderSchedule } from "./RenderSchedule";
import {
  BackgroundMapProps,
  BackgroundMapSettings,
} from "./BackgroundMapSettings";
import { SpatialClassificationProps } from "./SpatialClassificationProps";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "./PlanProjectionSettings";
import {
  LightSettings,
  LightSettingsProps,
} from "./LightSettings";
import {
  ThematicDisplay,
  ThematicDisplayProps,
} from "./ThematicDisplay";

/** Describes the [[SubCategoryOverride]]s applied to a [[SubCategory]] by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  /** The Id of the [[SubCategory]] whose appearance is to be overridden. */
  subCategory?: Id64String;
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
 * @public
 */
export interface ContextRealityModelProps {
  tilesetUrl: string;
  /** @alpha */
  orbitGtBlob?: OrbitGtBlobProps;
  name?: string;
  description?: string;
  /** @beta */
  classifiers?: SpatialClassificationProps.Properties[];
}

/** Describes the style in which monochrome color is applied by a [[DisplayStyleSettings]].
 * @public
 */
export enum MonochromeMode {
  /** The color of all geometry is replaced with the monochrome color. e.g., if monochrome color is white, all geometry will be white. */
  Flat = 0,
  /** The color of surfaces is computed as normal, then scaled to a shade of the monochrome color based on the surface color's intensity.
   * For example, if the monochrome color is white, this results in a greyscale affect.
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
  /** The color used in monochrome mode. Defaults to white. */
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
  /** Settings controlling display of map imagery within views of geolocated models. */
  backgroundMap?: BackgroundMapProps;
  /** Contextual Reality Models */
  contextRealityModels?: ContextRealityModelProps[];
  /** List of IDs of excluded elements */
  excludedElements?: Id64String[];
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
  /** Settings controlling display of visible and hidden edges.
   * @beta
   */
  hline?: HiddenLine.SettingsProps;
  /** Settings controlling display of ambient occlusion, stored in Props.
   * @beta
   */
  ao?: AmbientOcclusion.Props;
  /** Settings controlling display of solar shadows, stored in Props.
   * @beta
   */
  solarShadows?: SolarShadowSettingsProps;
  /** Scene lights. Incomplete.
   * @alpha
   */
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

/** Provides access to the settings defined by a [[DisplayStyle]] or [[DisplayStyleState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @beta
 */
export class DisplayStyleSettings {
  protected readonly _json: DisplayStyleSettingsProps;
  private readonly _viewFlags: ViewFlags;
  private readonly _background: ColorDef;
  private readonly _monochrome: ColorDef;
  private _monochromeMode: MonochromeMode;
  private readonly _subCategoryOverrides: Map<Id64String, SubCategoryOverride> = new Map<Id64String, SubCategoryOverride>();
  private readonly _excludedElements: Set<Id64String> = new Set<Id64String>();
  private _backgroundMap: BackgroundMapSettings;
  private _analysisStyle?: AnalysisStyle;

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

    this._monochrome = undefined !== this._json.monochromeColor ? ColorDef.fromJSON(this._json.monochromeColor) : ColorDef.white.clone();
    this._monochromeMode = MonochromeMode.Flat === this._json.monochromeMode ? MonochromeMode.Flat : MonochromeMode.Scaled;

    this._backgroundMap = BackgroundMapSettings.fromJSON(this._json.backgroundMap);

    if (this._json.analysisStyle)
      this._analysisStyle = AnalysisStyle.fromJSON(this._json.analysisStyle);

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

    const exElemArray = JsonUtils.asArray(this._json.excludedElements);
    if (undefined !== exElemArray) {
      for (const exElemStr of exElemArray) {
        const exElem = Id64.fromJSON(exElemStr);
        if (Id64.isValid(exElem)) {
          this._excludedElements.add(exElem);
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
    this._background.setFrom(color);
    this._json.backgroundColor = color.toJSON();
  }

  /** The color used to draw geometry in monochrome mode.
   * @note Do not modify the color in place. Clone it and pass the clone to the setter.
   * @see [[ViewFlags.monochrome]] for enabling monochrome mode.
   */
  public get monochromeColor(): ColorDef { return this._monochrome; }
  public set monochromeColor(color: ColorDef) {
    this._monochrome.setFrom(color);
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
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.overrideSubCategory]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void { this.changeSubCategoryOverride(id, true, ovr); }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.dropSubCategoryOverride]] to ensure
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

  /** The set of elements that the display style will exclude.
   * @returns The set of excluded elements.
   */
  public get excludedElements(): Set<Id64String> { return this._excludedElements; }

  /** Add an element to the set of excluded elements defined by the display style.
   * @param id The ID of the element to be excluded.
   */
  public addExcludedElements(id: Id64String) {
    if (Id64.isValid(id)) {
      if (undefined === this._json.excludedElements)
        this._json.excludedElements = [];
      this._json.excludedElements.push(id);
      this._excludedElements.add(id);
    }
  }

  /** Remove an element from the set of excluded elements defined by the display style.
   * @param id The ID of the element to be removed from the set of excluded elements.
   */
  public dropExcludedElement(id: Id64String) {
    if (this._json.excludedElements !== undefined) {
      const index = this._json.excludedElements.indexOf(id);
      if (index > -1)
        this._json.excludedElements.splice(index, 1);
      if (this._json.excludedElements.length === 0)
        this._json.excludedElements = undefined;
    }
    this._excludedElements.delete(id);
  }

  /** @internal */
  public toJSON(): DisplayStyleSettingsProps { return this._json; }

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
}

/** Provides access to the settings defined by a [[DisplayStyle3d]] or [[DisplayStyle3dState]], and ensures that
 * the style's JSON properties are kept in sync.
 * @beta
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
      const sunDir = this._json3d.sceneLights?.sunDir; // tslint:disable-line:deprecation
      this._lights = LightSettings.fromJSON(sunDir ? { solar: { direction: sunDir } } : undefined);
    }

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
  public toJSON(): DisplayStyle3dSettingsProps { return this._json3d; }

  /** The settings that control thematic display. */
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

  /** @alpha */
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
        delete this._json3d.planProjections![modelId];

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
