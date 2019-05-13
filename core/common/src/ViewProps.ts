/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64, Id64String, Id64Array, JsonUtils } from "@bentley/bentleyjs-core";
import { EntityQueryParams } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps } from "@bentley/geometry-core";
import { ElementProps, DefinitionElementProps, SheetProps } from "./ElementProps";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { ViewFlags, AnalysisStyleProps, HiddenLine, AmbientOcclusion, SolarShadows } from "./Render";
import { SubCategoryAppearance, SubCategoryOverride } from "./SubCategoryAppearance";
import { RenderSchedule } from "./RenderSchedule";
import { SpatialClassificationProps } from "./SpatialClassificationProps";

/** Returned from [IModelDb.Views.getViewStateData]($backend)
 * @public
 */
export interface ViewStateProps {
  viewDefinitionProps: ViewDefinitionProps;
  categorySelectorProps: CategorySelectorProps;
  modelSelectorProps?: ModelSelectorProps;
  /** @beta */
  displayStyleProps: DisplayStyleProps;
  /** @beta */
  sheetProps?: SheetProps;
  /** @beta */
  sheetAttachments?: Id64Array;
}

/** Properties that define a ModelSelector
 * @public
 */
export interface ModelSelectorProps extends DefinitionElementProps {
  models: Id64Array;
}

/** Properties that define a CategorySelector
 * @public
 */
export interface CategorySelectorProps extends DefinitionElementProps {
  categories: Id64Array;
}

/** @alpha Use ECSQL and IModelConnection.queryRows instead? */
export interface ViewQueryParams extends EntityQueryParams {
  wantPrivate?: boolean;
}

/** Parameters used to construct a ViewDefinition
 * @public
 */
export interface ViewDefinitionProps extends DefinitionElementProps {
  categorySelectorId: Id64String;
  displayStyleId: Id64String;
  description?: string;
}

/** JSON representation of [[ViewFlags]]
 * @public
 */
export interface ViewFlagProps {
  /** If true, don't show construction class. */
  noConstruct?: boolean;
  /** If true, don't show dimension class. */
  noDim?: boolean;
  /** If true, don't show patterns. */
  noPattern?: boolean;
  /** If true, don't line weights. */
  noWeight?: boolean;
  /** If true, don't line styles. */
  noStyle?: boolean;
  /** If true, don't use transparency. */
  noTransp?: boolean;
  /** @internal This doesn't belong here - it is not persistent. */
  contRend?: boolean;
  /** If true, don't show filled regions. */
  noFill?: boolean;
  /** If true, show grids. */
  grid?: boolean;
  /** If true, show AuxCoordSystem. */
  acs?: boolean;
  /** If true, don't show textures. */
  noTexture?: boolean;
  /** If true, don't show materials. */
  noMaterial?: boolean;
  /** If true, don't use camera lights. */
  noCameraLights?: boolean;
  /** If true, don't use source lights. */
  noSourceLights?: boolean;
  /** If true, don't use solar lights. */
  noSolarLight?: boolean;
  /** If true, show visible edges. */
  visEdges?: boolean;
  /** If true, show hidden edges. */
  hidEdges?: boolean;
  /** If true, show shadows. */
  shadows?: boolean;
  /** If true, use clipping volume. */
  clipVol?: boolean;
  /** If true, use hidden line material colors. */
  hlMatColors?: boolean;
  /** If true, show view with monochrome settings. */
  monochrome?: boolean;
  /** @internal unused */
  edgeMask?: number;
  /** [[RenderMode]] */
  renderMode?: number;
  /** Display background map. */
  backgroundMap?: boolean;
  /** If true, show ambient occlusion. */
  ambientOcclusion?: boolean;
  /** Controls whether surface discard is always applied regardless of other ViewFlags.
   * Surface shaders contain complicated logic to ensure that the edges of a surface always draw in front of the surface, and that planar surfaces sketched coincident with
   * non-planar surfaces always draw in front of those non-planar surfaces.
   * When this view flag is set to false (the default), then for 3d views if the render mode is wireframe (only edges are displayed) or smooth shader with visible edges turned off (only surfaces are displayed),
   * that logic does not execute, potentially improving performance for no degradation in visual quality. In some scenarios - such as wireframe views containing many planar regions with interior fill, or smooth views containing many coincident planar and non-planar surfaces - enabling this view flag improves display quality by forcing that logic to execute.
   */
  forceSurfaceDiscard?: boolean;
}

/** Describes the [[SubCategoryOverride]]s applied to a [[SubCategory]] by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  /** The Id of the [[SubCategory]] whose appearance is to be overridden. */
  subCategory?: Id64String;
}

/** Describes the type of background map displayed by a [[DisplayStyle]]
 * @see [[BackgroundMapProps]]
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export enum BackgroundMapType {
  Street = 1,
  Aerial = 2,
  Hybrid = 3,
}

/** JSON representation of the settings associated with a background map displayed by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export interface BackgroundMapProps {
  groundBias?: number;
  /** "BingProvider" | "MapProvider" currently supported; others may be added in future. */
  providerName?: string;
  providerData?: {
    mapType?: BackgroundMapType;
  };
}

/** JSON representation of a [[GroundPlane]].
 * @public
 */
export interface GroundPlaneProps {
  /** Whether the ground plane should be displayed. Defaults to false. */
  display?: boolean;
  /** The Z height at which to draw the ground plane. */
  elevation?: number;
  /** The color in which to draw the ground plane when viewed from above. */
  aboveColor?: ColorDefProps;
  /** The color in which to draw the ground plane when viewed from below. */
  belowColor?: ColorDefProps;
}

/** Enumerates the supported types of [SkyBox]($frontend) images.
 * @public
 */
export enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [[SkySphere]] */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [[SkyCube]] */
  Cube,
  /** @internal not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [[SkyCube]]. Each property specifies the element ID of a texture associated with one face of the cube.
 * @public
 */
export interface SkyCubeProps {
  /** Id of a persistent texture element stored in the iModel to use for the front side of the skybox cube. */
  front?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the back side of the skybox cube. */
  back?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the top of the skybox cube. */
  top?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the bottom of the skybox cube. */
  bottom?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the right side of the skybox cube. */
  right?: Id64String;
  /** Id of a persistent texture element stored in the iModel to use for the left side of the skybox cube. */
  left?: Id64String;
}

/** JSON representation of an image or images used by a [[SkySphere]] or [[SkyCube]].
 * @public
 */
export interface SkyBoxImageProps {
  /** The type of skybox image. */
  type?: SkyBoxImageType;
  /** For [[SkyBoxImageType.Spherical]], the Id of a persistent texture element stored in the iModel to be drawn as the "sky". */
  texture?: Id64String;
  /** For [[SkyBoxImageType.Cube]], the Ids of persistent texture elements stored in the iModel drawn on each face of the cube. */
  textures?: SkyCubeProps;
}

/** JSON representation of a [SkyBox]($frontend).
 * @public
 */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed. Defaults to false. */
  display?: boolean;
  /** For a [[SkyGradient]], if true, a 2-color gradient skybox is used instead of a 4-color. Defaults to false. */
  twoColor?: boolean;
  /** For a 4-color [[SkyGradient]], the color of the sky at the horizon. */
  skyColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the ground at the horizon. */
  groundColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the sky when looking straight up. For a 2-color [[SkyGradient]], the color of the sky. */
  zenithColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], the color of the ground when looking straight down. For a 2-color [[SkyGradient]], the color of the ground. */
  nadirColor?: ColorDefProps;
  /** For a 4-color [[SkyGradient]], controls speed of change from sky color to zenith color. */
  skyExponent?: number;
  /** For a 4-color [[SkyGradient]], controls speed of change from ground color to nadir color. */
  groundExponent?: number;
  /** For a [[SkySphere]] or [[SkyCube]], the skybox image(s). */
  image?: SkyBoxImageProps;
}

/** JSON representation of a solar shadow settings.
 * @beta
 */
export interface SolarShadowProps {
  /** Shadow color */
  color?: ColorDefProps;
  /** Shadow bias - a nonzero bias is required to avoid self-shadowing effects. */
  bias?: number;
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
  classifiers?: SpatialClassificationProps.PropertiesProps[];
}

/** JSON representation of the settings associated with a [[DisplayStyleProps]].
 * These settings are not stored directly as members of the [[DisplayStyleProps]]. Instead, they are stored
 * as members of `jsonProperties.styles`.
 * @see [[DisplayStyleSettings]].
 * @beta
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
  /** Schedule script */
  scheduleScript?: RenderSchedule.ElementTimelineProps[];
  /** Overrides applied to the appearances of subcategories in the view. */
  subCategoryOvr?: DisplayStyleSubCategoryProps[];
  /** Settings controlling display of map imagery within views of geolocated models. */
  backgroundMap?: BackgroundMapProps;
  /** Contextual Reality Models */
  ContextRealityModels?: ContextRealityModelProps[];
  /** List of IDs of excluded elements */
  excludedElements?: Id64String[];
}

/** JSON representation of settings associated with a [[DisplayStyle3dProps]].
 * @see [[DisplayStyle3dSettings]].
 * @beta
 */
export interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  /** Settings controlling display of skybox and ground plane. */
  environment?: EnvironmentProps;
  /** Settings controlling display of visible and hidden edges. */
  hline?: HiddenLine.SettingsProps;
  /** Settings controlling display of ambient occlusion, stored in Props. */
  ao?: AmbientOcclusion.Props;
  /** Settings controlling display of solar shadoss, stored in Props. */
  solarShadows?: SolarShadows.Props;
}

/** JSON representation of a [[DisplayStyle]] or [[DisplayStyleState]].
 * @beta
 */
export interface DisplayStyleProps extends DefinitionElementProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyleSettingsProps;
  };
}

/** JSON representation of a [[DisplayStyle3d]] or [[DisplayStyle3dState]].
 * @beta
 */
export interface DisplayStyle3dProps extends DisplayStyleProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyle3dSettingsProps;
  };
}

/** properties of a camera
 * @public
 */
export interface CameraProps {
  lens: AngleProps;
  focusDist: number; // NOTE: this is abbreviated, do not change!
  eye: XYZProps;
}

/** Parameters to construct a ViewDefinition3d
 * @public
 */
export interface ViewDefinition3dProps extends ViewDefinitionProps {
  /** if true, camera is valid. */
  cameraOn: boolean;
  /** The lower left back corner of the view frustum. */
  origin: XYZProps;
  /** The extent of the view frustum. */
  extents: XYZProps;
  /** Rotation of the view frustum (could be undefined if going Matrix3d -> YawPitchRoll). */
  angles?: YawPitchRollProps;
  /** The camera used for this view. */
  camera: CameraProps;
}

/** Parameters to construct a SpatialViewDefinition
 * @public
 */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: Id64String;
}

/** Parameters used to construct a ViewDefinition2d
 * @public
 */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64String;
  origin: XYProps;
  delta: XYProps;
  angle: AngleProps;
}

/** @public */
export interface AuxCoordSystemProps extends ElementProps {
  type?: number;
  description?: string;
}

/**  Properties of AuxCoordSystem2d
 * @public
 */
export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  /** Origin of the AuxCoordSystem2d */
  origin?: XYProps;
  /** Rotation angle */
  angle?: AngleProps;
}

/** Properties of AuxCoordSystem3d
 * @public
 */
export interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  /** Origin of the AuxCoordSystem3d */
  origin?: XYZProps;
  /** Yaw angle */
  yaw?: AngleProps;
  /** Pitch angle */
  pitch?: AngleProps;
  /** Roll angle */
  roll?: AngleProps;
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
  private readonly _subCategoryOverrides: Map<string, SubCategoryOverride> = new Map<string, SubCategoryOverride>();
  private readonly _excludedElements: Set<Id64String> = new Set<Id64String>();

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

  /** @internal */
  public get backgroundMap(): BackgroundMapProps | undefined {
    const props = this._json.backgroundMap;
    return undefined !== props ? props : {};
  }
  /** @internal */
  public set backgroundMap(map: BackgroundMapProps | undefined) { this._json.backgroundMap = map; }

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

  /** Obtain the overrides applied to a [[SubCategoryAppearance]] by this style.
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
  private get _json3d(): DisplayStyle3dSettingsProps { return this._json as DisplayStyle3dSettingsProps; }

  public constructor(jsonProperties: { styles?: DisplayStyle3dSettingsProps }) {
    super(jsonProperties);
    this._hline = HiddenLine.Settings.fromJSON(this._json3d.hline);
    this._ao = AmbientOcclusion.Settings.fromJSON(this._json3d.ao);
    this._solarShadows = SolarShadows.Settings.fromJSON(this._json3d.solarShadows);
  }

  /** @internal */
  public toJSON(): DisplayStyle3dSettingsProps { return this._json3d; }

  /** The settings that control how visible and hidden edges are displayed.
   * @note Do not modify the settings in place. Clone them and pass the clone to the setter.
   */
  public get hiddenLineSettings(): HiddenLine.Settings { return this._hline; }
  public set hiddenLineSettings(hline: HiddenLine.Settings) {
    this._hline = hline;
    this._json3d.hline = hline.toJSON();
  }

  /** The settings that control how ambient occlusion is displayed.
   * @note Do not modify the settings in place. Clone them and pass the clone to the setter.
   */
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

  /** @internal */
  public set environment(environment: EnvironmentProps) { this._json3d.environment = environment; }
}
