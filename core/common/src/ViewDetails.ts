/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import {
  Id64,
  Id64String,
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  ClipVector,
  Geometry,
  XAndY,
} from "@bentley/geometry-core";

/** @internal */
export interface ViewDetailsProps {
  /** Id of the aux coord system. Default: invalid. */
  acs?: Id64String;
  /** Aspect ratio skew (x/y) used to exaggerate the y axis of the view. Default: 1.0. */
  aspectSkew?: number;
  /** Grid orientation. Default: WorldXY. */
  gridOrient?: GridOrientationType;
  /** Default: 10. */
  gridPerRef?: number;
  /** Default: 1.0. */
  gridSpaceX?: number;
  /** Default: same as gridSpaceX. */
  gridSpaceY?: number;
  /** Clip applied to the view. */
  clip?: any;
}

/** Describes the orientation of the grid displayed within a viewport.
 * @public
 */
export enum GridOrientationType {
  /** Oriented with the view. */
  View = 0,
  /** Top */
  WorldXY = 1,
  /** Right */
  WorldYZ = 2,
  /** Front */
  WorldXZ = 3,
  /** Oriented by the auxiliary coordinate system. */
  AuxCoord = 4,
}

/** @internal */
export interface ViewDetails3dProps extends ViewDetailsProps {
  /** Whether viewing tools are allowed to operate in 3 dimensions on this view. Default: true. */
  allow3dManipulations?: boolean;
}

/** Encapsulates access to optional view details stored in JSON properties.
 * @beta
 */
export class ViewDetails {
  protected readonly _json: ViewDetailsProps;
  private _clipVector?: ClipVector;

  /** @internal */
  public constructor(jsonProperties: { viewDetails?: ViewDetailsProps }) {
    if (undefined === jsonProperties.viewDetails)
      jsonProperties.viewDetails = { };

    this._json = jsonProperties.viewDetails;
  }

  /** The Id of the auxiliary coordinate system for the view. */
  public get auxiliaryCoordinateSystemId(): Id64String {
    return Id64.fromJSON(this._json.acs);
  }
  public set auxiliaryCoordinateSystemId(id: Id64String) {
    this._json.acs = Id64.isValidId64(id) ? id : undefined;
  }

  /** The aspect ratio skew (x/y, usually 1.0) used to exaggerate the y axis of the view. */
  public get aspectRatioSkew(): number {
    const maxSkew = 25;
    const skew = JsonUtils.asDouble(this._json.aspectSkew, 1.0);
    return Geometry.clamp(skew, 1 / maxSkew, maxSkew);
  }
  public set aspectRatioSkew(skew: number) {
    this._json.aspectSkew = 1.0 !== skew ? skew : undefined;
  }

  /** The orientation of the view's grid. */
  public get gridOrientation(): GridOrientationType {
    return JsonUtils.asInt(this._json.gridOrient, GridOrientationType.WorldXY);
  }
  public set gridOrientation(orientation: GridOrientationType) {
    this._json.gridOrient = GridOrientationType.WorldXY === orientation ? undefined : orientation;
  }

  /** The number of grids per ref for the view. */
  public get gridsPerRef(): number {
    return JsonUtils.asInt(this._json.gridPerRef, 10);
  }
  public set gridsPerRef(gridsPerRef: number) {
    this._json.gridPerRef = 10 === gridsPerRef ? undefined : gridsPerRef;
  }

  /** The grid spacing for the view. */
  public get gridSpacing(): XAndY {
    const x = JsonUtils.asDouble(this._json.gridSpaceX, 1.0);
    const y = JsonUtils.asDouble(this._json.gridSpaceY, x);
    return { x, y };
  }
  public set gridSpacing(spacing: XAndY) {
    this._json.gridSpaceX = 1.0 !== spacing.x ? spacing.x : undefined;
    this._json.gridSpaceY = spacing.x !== spacing.y ? spacing.y : undefined;
  }

  /** Clipping volume for the view.
   * @note Do *not* modify the returned ClipVector. If you wish to change the ClipVector, clone the returned ClipVector, modify it as desired, and pass the clone back to the setter.
   */
  public get clipVector(): ClipVector | undefined {
    if (undefined === this._clipVector) {
      const clip = this._json.clip;
      this._clipVector = (undefined !== clip ? ClipVector.fromJSON(clip) : ClipVector.createEmpty());
    }

    return this._clipVector.isValid ? this._clipVector : undefined;
  }
  public set clipVector(clip: ClipVector | undefined) {
    this._clipVector = clip;
    if (undefined !== clip && clip.isValid)
      this._json.clip = clip.toJSON();
    else
      this._json.clip = undefined;
  }

  /** Returns internal JSON representation. This is *not* a copy.
   * @internal
   */
  public toJSON(): ViewDetailsProps {
    return this._json;
  }
}

/** Encapsulates access to optional 3d view details stored in JSON properties.
 * @beta
 */
export class ViewDetails3d extends ViewDetails {
  private get _json3d(): ViewDetails3dProps {
    return this._json as ViewDetails3dProps;
  }

  /** @internal */
  public constructor(jsonProperties: { viewDetails?: ViewDetails3dProps }) {
    super(jsonProperties);
  }

  /** Controls whether viewing tools are allowed to operate on the view in 3 dimensions.
   * @beta
   */
  public get allow3dManipulations(): boolean {
    return JsonUtils.asBool(this._json3d.allow3dManipulations, true);
  }
  public set allow3dManipulations(allow: boolean) {
    this._json3d.allow3dManipulations = allow ? undefined : false;
  }

  /** @internal */
  public toJSON(): ViewDetails3dProps {
    return this._json3d;
  }
}
