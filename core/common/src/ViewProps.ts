/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64, Id64String, Id64Array, JsonUtils } from "@bentley/bentleyjs-core";
import { EntityQueryParams } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps } from "@bentley/geometry-core";
import { ElementProps, DefinitionElementProps, SheetProps } from "./ElementProps";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { ViewFlags, AnalysisStyleProps, HiddenLine } from "./Render";
import { SubCategoryAppearance, SubCategoryOverride } from "./SubCategoryAppearance";
import { RenderSchedule } from "./RenderSchedule";

/** Returned from [IModelDb.Views.getViewStateData]($backend) */
export interface ViewStateData {
  viewDefinitionProps: ViewDefinitionProps;
  categorySelectorProps: CategorySelectorProps;
  displayStyleProps: DisplayStyleProps;
  modelSelectorProps?: ModelSelectorProps;
  sheetProps?: SheetProps;
  sheetAttachments?: Id64Array;
}

/** Properties that define a ModelSelector */
export interface ModelSelectorProps extends DefinitionElementProps {
  models: Id64Array;
}

/** Properties that define a CategorySelector */
export interface CategorySelectorProps extends DefinitionElementProps {
  categories: Id64Array;
}

export interface ViewQueryParams extends EntityQueryParams {
  wantPrivate?: boolean;
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionProps extends DefinitionElementProps {
  categorySelectorId: Id64String;
  displayStyleId: Id64String;
  description?: string;
}

/** JSON representation of [[ViewFlags]] */
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
  /** @hidden This doesn't belong here - it is not persistent. */
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
  /** @hidden unused */
  edgeMask?: number;
  /** [[RenderMode]] */
  renderMode?: number;
  /** Display background map. */
  backgroundMap?: boolean;
}

/** Describes the [[SubCategoryOverride]]s applied to a [[SubCategory]] by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 */
export interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  /** The Id of the [[SubCategory]] whose appearance is to be overridden. */
  subCategory?: Id64String;
}

/** Describes the type of background map displayed by a [[DisplayStyle]]
 * @see [[BackgroundMapProps]]
 * @see [[DisplayStyleSettingsProps]]
 */
export const enum BackgroundMapType {
  Street = 1,
  Aerial = 2,
  Hybrid = 3,
}

/** JSON representation of the settings associated with a background map displayed by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 */
export interface BackgroundMapProps {
  groundBias?: number;
  /** "BingProvider" | "MapProvider" currently supported; others may be added in future. */
  providerName?: string;
  providerData?: {
    mapType?: BackgroundMapType;
  };
}

/** JSON representation of a [[GroundPlane]]. */
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

/** Enumerates the supported types of [[SkyBox]] images. */
export const enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [[SkySphere]] */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [[SkyCube]] */
  Cube,
  /** @hidden not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [[SkyCube]]. Each property specifies the element ID of a texture associated with one face of the cube. */
export interface SkyCubeProps {
  front?: Id64String;
  back?: Id64String;
  top?: Id64String;
  bottom?: Id64String;
  right?: Id64String;
  left?: Id64String;
}

/** JSON representation of an image or images used by a [[SkySphere]] or [[SkyCube]]. */
export interface SkyBoxImageProps {
  /** The type of skybox image. */
  type?: SkyBoxImageType;
  /** For [[SkyBoxImageType.Spherical]], the element ID of the texture to be drawn as the "sky". */
  texture?: Id64String;
  /** For [[SkyBoxImageType.Cube]], the IDs of the texture elements drawn on each face of the cube. */
  textures?: SkyCubeProps;
}

/** JSON representation of a [[SkyBox]]. */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed. Defaults to false. */
  display?: boolean;
  /** @hidden ###TODO Figure out how this is used... */
  twoColor?: boolean;
  /** @hidden ###TODO Figure out how this is used... */
  groundExponent?: number;
  /** @hidden ###TODO Figure out how this is used... */
  skyExponent?: number;
  /** For a [[SkyGradient]], the color of the ground. */
  groundColor?: ColorDefProps;
  /** @hidden ###TODO Figure out how this is used... */
  zenithColor?: ColorDefProps;
  /** @hidden ###TODO Figure out how this is used... */
  nadirColor?: ColorDefProps;
  /** For a [[SkyGradient]], the color of the sky. */
  skyColor?: ColorDefProps;
  /** For a [[SkySphere]] or [[SkyCube]], the skybox image(s). */
  image?: SkyBoxImageProps;
}

/** JSON representation of the environment setup of a [[DisplayStyle3d]]. */
export interface EnvironmentProps {
  ground?: GroundPlaneProps;
  sky?: SkyBoxProps;
}
/** JSON representation of a context reality model */
export interface ContextRealityModelProps {
  tilesetUrl: string;
  name?: string;
}

/** JSON representation of the settings associated with a [[DisplayStyleProps]].
 * These settings are not stored directly as members of the [[DisplayStyleProps]]. Instead, they are stored
 * as members of `jsonProperties.styles`.
 * @see [[DisplayStyleSettings]].
 */
export interface DisplayStyleSettingsProps {
  viewflags?: ViewFlagProps;
  /** The color displayed in the view background. Defaults to black. */
  backgroundColor?: ColorDefProps;
  /** The color used in monochrome mode. Defaults to white. */
  monochromeColor?: ColorDefProps;
  /** Settings controlling display of analytical models. */
  analysisStyle?: AnalysisStyleProps;
  /** Schedule script */
  scheduleScript?: RenderSchedule.ElementTimelineProps[];
  /** Overrides applied to the appearances of subcategories in the view. */
  subCategoryOvr?: DisplayStyleSubCategoryProps[];
  /** Settings controlling display of map imagery within views of geolocated models. */
  backgroundMap?: BackgroundMapProps;
  /** Contexual Reality Models */
  ContextRealityModels?: ContextRealityModelProps[];
}

/** JSON representation of settings assocaited with a [[DisplayStyle3dProps]].
 * @see [[DisplayStyle3dSettings]].
 */
export interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  /** Settings controlling display of skybox and ground plane. */
  environment?: EnvironmentProps;
  /** Settings controlling display of visible and hidden edges. */
  hline?: HiddenLine.SettingsProps;
}

/** JSON representation of a [[DisplayStyle]] or [[DisplayStyleState]]. */
export interface DisplayStyleProps extends DefinitionElementProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyleSettingsProps;
  };
}

/** JSON representation of a [[DisplayStyle3d]] or [[DisplayStyle3dState]]. */
export interface DisplayStyle3dProps extends DisplayStyleProps {
  /** Display styles store their settings in a `styles` property within [[ElementProps.jsonProperties]]. */
  jsonProperties?: {
    styles?: DisplayStyle3dSettingsProps;
  };
}

/** properties of a camera */
export interface CameraProps {
  lens: AngleProps;
  focusDist: number; // NOTE: this is abbreviated, do not change!
  eye: XYZProps;
}

/** Parameters to construct a ViewDefinition3d */
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

/** Parameters to construct a SpatialViewDefinition */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: Id64String;
}

/** Parameters used to construct a ViewDefinition2d */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64String;
  origin: XYProps;
  delta: XYProps;
  angle: AngleProps;
}

export interface AuxCoordSystemProps extends ElementProps {
  type?: number;
  description?: string;
}

/**  Properties of AuxCoordSystem2d */
export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  /** Origin of the AuxCoordSystem2d */
  origin?: XYProps;
  /** Rotation angle */
  angle?: AngleProps;
}

/** Properties of AuxCoordSystem3d */
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
 */
export class DisplayStyleSettings {
  protected readonly _json: DisplayStyleSettingsProps;
  private readonly _viewFlags: ViewFlags;
  private readonly _background: ColorDef;
  private readonly _monochrome: ColorDef;
  private readonly _subCategoryOverrides: Map<string, SubCategoryOverride> = new Map<string, SubCategoryOverride>();

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

  /** @hidden */
  public get backgroundMap(): BackgroundMapProps | undefined {
    const props = this._json.backgroundMap;
    return undefined !== props ? props : {};
  }
  /** @hidden */
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
      }
    }
  }
}

/** Provides access to the settings defined by a [[DisplayStyle3d]] or [[DisplayStyle3dState]], and ensures that
 * the style's JSON properties are kept in sync.
 */
export class DisplayStyle3dSettings extends DisplayStyleSettings {
  private _hline: HiddenLine.Settings;
  private get _json3d(): DisplayStyle3dSettingsProps { return this._json as DisplayStyle3dSettingsProps; }

  public constructor(jsonProperties: { styles?: DisplayStyle3dSettingsProps }) {
    super(jsonProperties);
    this._hline = HiddenLine.Settings.fromJSON(this._json3d.hline);
  }

  public toJSON(): DisplayStyle3dSettingsProps { return this._json3d; }

  /** The settings that control how visible and hidden edges are displayed.
   * @note Do not modify the settings in place. Clone them and pass the clone to the setter.
   */
  public get hiddenLineSettings(): HiddenLine.Settings { return this._hline; }
  public set hiddenLineSettings(hline: HiddenLine.Settings) {
    this._hline = hline;
    this._json3d.hline = hline.toJSON();
  }

  /** @hidden */
  public get environment(): EnvironmentProps {
    const env = this._json3d.environment;
    return undefined !== env ? env : {};
  }

  /** @hidden */
  public set environment(environment: EnvironmentProps) { this._json3d.environment = environment; }
}
