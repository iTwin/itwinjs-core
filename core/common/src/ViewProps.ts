/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { AngleProps, Range3dProps, XYProps, XYZProps, YawPitchRollProps } from "@bentley/geometry-core";
import { CameraProps } from "./Camera";
import { DisplayStyleProps } from "./DisplayStyleSettings";
import { DefinitionElementProps, DisplayStyleLoadProps, ElementProps, SheetProps } from "./ElementProps";
import { EntityQueryParams } from "./EntityProps";
import { ViewDetails3dProps, ViewDetailsProps } from "./ViewDetails";

/** Returned from [IModelDb.Views.getViewStateData]($backend).
 * @public
 */
export interface ViewStateProps {
  viewDefinitionProps: ViewDefinitionProps;
  categorySelectorProps: CategorySelectorProps;
  modelSelectorProps?: ModelSelectorProps;
  displayStyleProps: DisplayStyleProps;
  /** @beta */
  sheetProps?: SheetProps;
  /** @beta */
  sheetAttachments?: Id64Array;
  /** For drawing views, the extents of the drawing model.
   * @alpha
   */
  modelExtents?: Range3dProps;
}

/** Options for loading a [[ViewStateProps]] via [IModelConnection.Views.load]($frontend) or [IModelDb.Views.getViewStateData]($backend).
 * @public
 */
export interface ViewStateLoadProps {
  /** Options for loading the view's [[DisplayStyleProps]]. */
  displayStyle?: DisplayStyleLoadProps;
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

/** Parameters for performing a query on [ViewDefinition]($backend) classes.
 * @public
 */
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
  /** @internal */
  jsonProperties?: {
    viewDetails?: ViewDetailsProps;
  };
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
  /** @internal */
  jsonProperties?: {
    viewDetails?: ViewDetails3dProps;
  };
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
