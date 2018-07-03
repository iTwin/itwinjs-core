/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64Props } from "@bentley/bentleyjs-core";
import { EntityQueryParams } from "./EntityProps";
import { AngleProps, XYZProps, XYProps, YawPitchRollProps, Matrix4d, Matrix4dProps } from "@bentley/geometry-core";
import { ElementProps, DefinitionElementProps } from "./ElementProps";

/** properties that define a ModelSelector */
export interface ModelSelectorProps extends ElementProps {
  models: string[];
}

/** properties that define a CategorySelector */
export interface CategorySelectorProps extends ElementProps {
  categories: string[];
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

/**
 * Properties of AuxCoordSystem2d
 * @note angle is stored in degrees
 */
export interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  origin?: XYProps;
  angle?: number; // in degrees
}

/**
 * Properties of AuxCoordSystem3d
 * @note All angles are stored in degrees
 */
export interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  origin?: XYZProps;
  yaw?: AngleProps;  // in degrees
  pitch?: AngleProps; // in degrees
  roll?: AngleProps; // in degrees
}

export interface SnapRequestProps {
  id: Id64Props;
  closePoint: XYZProps;
  worldToView: Matrix4dProps;
  viewFlags?: any;
  snapMode?: number;
  snapAperture?: number;
  snapDivisor?: number;
  offSubCategories?: string[];
}

export interface SnapResponseProps {
  status?: number;
  heat?: number;
  geomType?: number;
  parentGeomType?: number;
  subCategory?: string;
  weight: number;
  snapPoint?: XYZProps;
  curve?: any;
  localToWorld?: Matrix4d;
  normal?: XYZProps;
}
