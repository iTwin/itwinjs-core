/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64Props, Id64Array } from "@bentley/bentleyjs-core";
import { EntityQueryParams } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps } from "@bentley/geometry-core";
import { ElementProps, DefinitionElementProps, SheetProps } from "./ElementProps";
import { ColorDef } from "./ColorDef";
import { ViewFlags } from "./Render";

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
export interface ModelSelectorProps extends ElementProps {
  models: string[];
}

/** Properties that define a CategorySelector */
export interface CategorySelectorProps extends ElementProps {
  categories: string[];
}

/** Properties that define a DisplayStyle */
export interface DisplayStyleProps extends ElementProps {
  viewFlags: ViewFlags;
  backgroundColor: ColorDef;
  monochromeColor: ColorDef;
}

export interface ViewQueryParams extends EntityQueryParams {
  wantPrivate?: boolean;
}

/** Parameters used to construct a ViewDefinition */
export interface ViewDefinitionProps extends DefinitionElementProps {
  categorySelectorId: Id64Props;
  displayStyleId: Id64Props;
  description?: string;
}

/** Properties of [[ViewFlags]] */
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
  /** If true, use continuous rendering. */
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
  /** Edge mask. 0=none, 1=generate mask, 2=use mask. */
  edgeMask?: number;
  /** [[RenderMode]] */
  renderMode?: number;
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
  /** Rotation of the view frustum (could be undefined if going RotMatrix -> YawPitchRoll). */
  angles?: YawPitchRollProps;
  /** The camera used for this view. */
  camera: CameraProps;
}

/** Parameters to construct a SpatialViewDefinition */
export interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  modelSelectorId: Id64Props;
}

/** Parameters used to construct a ViewDefinition2d */
export interface ViewDefinition2dProps extends ViewDefinitionProps {
  baseModelId: Id64Props;
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
