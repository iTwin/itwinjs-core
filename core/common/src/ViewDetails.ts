/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ClipVector, ClipVectorProps, Geometry, XAndY } from "@bentley/geometry-core";
import { ModelClipGroupProps, ModelClipGroups } from "./ModelClipGroup";

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
  clip?: ClipVectorProps;
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
  /** Whether viewing tools are prohibited from operating in 3 dimensions on this view. Default: false. */
  disable3dManipulations?: boolean;
  /** Defines how to clip groups of models. */
  modelClipGroups?: ModelClipGroupProps[];
}

/** Encapsulates access to optional view details stored in JSON properties.
 * @beta
 */
export class ViewDetails {
  /** @internal */
  protected readonly _json: ViewDetailsProps;
  private _clipVector?: ClipVector;

  /** @internal */
  public constructor(jsonProperties: { viewDetails?: ViewDetailsProps }) {
    if (!jsonProperties.viewDetails)
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

  /** Maximum aspect ratio skew. Apps can override this by changing its value.
   * @internal
   */
  public static maxSkew = 25;

  /** The aspect ratio skew (x/y, usually 1.0) used to exaggerate the y axis of the view. */
  public get aspectRatioSkew(): number {
    const maxSkew = ViewDetails.maxSkew;
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

  /** Returns the internal JSON representation. This is *not* a copy.
   * @internal
   */
  public getJSON(): ViewDetailsProps {
    return this._json;
  }
}

/** Encapsulates access to optional 3d view details stored in JSON properties.
 * @beta
 */
export class ViewDetails3d extends ViewDetails {
  private _modelClipGroups?: ModelClipGroups;

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
    return !JsonUtils.asBool(this._json3d.disable3dManipulations, false);
  }
  public set allow3dManipulations(allow: boolean) {
    this._json3d.disable3dManipulations = allow ? undefined : true;
  }

  /** Groups of models associated with [ClipVector]($geometry-core)s by which those models should be clipped.
   * If `this.clipVector` is not undefined, then the view as a whole will be clipped by that clip; the per-model group clips will have no effect.
   * If the `clipVolume` [[ViewFlags]] is `false`, no clipping will be applied.
   * @note Do **not** modify the returned object directly. Instead, clone it, modify the clone, and pass the clone to the property setter.
   * @alpha
   */
  public get modelClipGroups(): ModelClipGroups {
    if (!this._modelClipGroups)
      this._modelClipGroups = ModelClipGroups.fromJSON(this._json3d.modelClipGroups);

    return this._modelClipGroups;
  }
  public set modelClipGroups(groups: ModelClipGroups) {
    this._modelClipGroups = groups;
    this._json3d.modelClipGroups = groups.toJSON();
    this.onModelClipGroupsChanged.raiseEvent(this);
  }

  /** @internal */
  public readonly onModelClipGroupsChanged = new BeEvent<(details: ViewDetails3d) => void>();

  /** Returns the internal JSON representation. This is *not* a copy.
   * @internal
   */
  public getJSON(): ViewDetails3dProps {
    return this._json3d;
  }
}
