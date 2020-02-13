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
import {
  Vector3d,
  XYZProps,
} from "@bentley/geometry-core";
import { HiddenLine } from "./HiddenLine";
import { AmbientOcclusion } from "./AmbientOcclusion";
import { SolarShadows } from "./SolarShadows";
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
import { AnalysisStyleProps } from "./AnalysisStyle";
import { RenderSchedule } from "./RenderSchedule";
import {
  BackgroundMapProps,
  BackgroundMapSettings,
} from "./BackgroundMapSettings";
import { SpatialClassificationProps } from "./SpatialClassificationProps";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "./PlanProjectionSettings";

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

/** JSON representation of a context reality model
 * @public
 */
export interface ContextRealityModelProps {
  tilesetUrl: string;
  name?: string;
  description?: string;
  /** @beta */
  classifiers?: SpatialClassificationProps.Properties[];
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
  /** Settings controlling display of analytical models.
   * @alpha
   */
  analysisStyle?: AnalysisStyleProps;
  /** Schedule script
   * @beta
   */
  scheduleScript?: RenderSchedule.ModelTimelineProps[];
  /** Overrides applied to the appearances of subcategories in the view. */
  subCategoryOvr?: DisplayStyleSubCategoryProps[];
  /** Settings controlling display of map imagery within views of geolocated models. */
  backgroundMap?: BackgroundMapProps;
  /** Contextual Reality Models */
  contextRealityModels?: ContextRealityModelProps[];
  /** List of IDs of excluded elements */
  excludedElements?: Id64String[];
}

/** This is incomplete. Many of the lighting properties from MicroStation are not useful or not used in iModel.js.
 * @alpha
 */
export interface SceneLightsProps {
  sunDir?: XYZProps;
}

/** JSON representation of settings associated with a [[DisplayStyle3dProps]].
 * @see [[DisplayStyle3dSettings]].
 * @public
 */
export interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  /** Settings controlling display of skybox and ground plane. */
  environment?: EnvironmentProps;
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
  solarShadows?: SolarShadows.Props;
  /** Scene lights. Incomplete.
   * @alpha
   */
  sceneLights?: SceneLightsProps;
  /** Settings controlling how plan projection models are to be rendered. The key for each entry is the Id of the model to which the settings apply.
   * @alpha
   */
  planProjections?: { [modelId: string]: PlanProjectionSettingsProps };
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
  private readonly _subCategoryOverrides: Map<Id64String, SubCategoryOverride> = new Map<Id64String, SubCategoryOverride>();
  private readonly _excludedElements: Set<Id64String> = new Set<Id64String>();
  private _backgroundMap: BackgroundMapSettings;

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
    this._backgroundMap = BackgroundMapSettings.fromJSON(this._json.backgroundMap);

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

  /** @alpha */
  public get backgroundMap(): BackgroundMapSettings { return this._backgroundMap; }

  public set backgroundMap(map: BackgroundMapSettings) {
    if (!this.backgroundMap.equals(map)) {
      this._backgroundMap = map; // it's an immutable type.
      this._json.backgroundMap = map.toJSON();
    }
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
  private _hline: HiddenLine.Settings;
  private _ao: AmbientOcclusion.Settings;
  private _solarShadows: SolarShadows.Settings;
  private _sunDir?: Vector3d;
  private _planProjections?: Map<string, PlanProjectionSettings>;

  private get _json3d(): DisplayStyle3dSettingsProps { return this._json as DisplayStyle3dSettingsProps; }

  public constructor(jsonProperties: { styles?: DisplayStyle3dSettingsProps }) {
    super(jsonProperties);
    this._hline = HiddenLine.Settings.fromJSON(this._json3d.hline);
    this._ao = AmbientOcclusion.Settings.fromJSON(this._json3d.ao);
    this._solarShadows = SolarShadows.Settings.fromJSON(this._json3d.solarShadows);
    if (undefined !== this._json3d.sceneLights && undefined !== this._json3d.sceneLights.sunDir)
      this._sunDir = Vector3d.fromJSON(this._json3d.sceneLights.sunDir);

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

  /** The settings that control how solar shadows are displayed.
   * @note Do not modify the settings in place. Clone them and pass the clone to the setter.
   */
  public get solarShadowsSettings(): SolarShadows.Settings { return this._solarShadows; }
  public set solarShadowsSettings(solarShadows: SolarShadows.Settings) {
    this._solarShadows = solarShadows;
    this._json3d.solarShadows = solarShadows.toJSON();
  }
  /** @internal */
  public get environment(): EnvironmentProps {
    const env = this._json3d.environment;
    return undefined !== env ? env : {};
  }
  public set environment(environment: EnvironmentProps) { this._json3d.environment = environment; }

  /** @internal */
  public get sunDir(): Vector3d | undefined {
    return this._sunDir;
  }
  public set sunDir(dir: Vector3d | undefined) {
    if (undefined === dir) {
      this._sunDir = undefined;
      if (undefined !== this._json3d.sceneLights)
        this._json3d.sceneLights.sunDir = undefined;

      return;
    }

    this._sunDir = dir.clone(this._sunDir);
    if (undefined === this._json3d.sceneLights)
      this._json3d.sceneLights = {};

    this._json3d.sceneLights.sunDir = dir.toJSON();
  }

  /** @alpha */
  public getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined {
    return undefined !== this._planProjections ? this._planProjections.get(modelId) : undefined;
  }

  /** @alpha */
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

  /** @alpha */
  public get planProjectionSettings(): Iterable<[Id64String, PlanProjectionSettings]> | undefined {
    return undefined !== this._planProjections ? this._planProjections.entries() : undefined;
  }
}
