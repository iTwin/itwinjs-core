/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, Id64, Id64Array, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { ClipVector, Geometry, XAndY } from "@bentley/geometry-core";

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
export interface ModelClipGroupProps {
  models?: Id64Array;
  clip?: any;
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

/** Describes how to clip a group of models in the context of a [ViewDefinition3d]($backend).
 * @see [[ModelClipGroups]].
 * @alpha
 */
export class ModelClipGroup {
  /** The Ids of the models to be clipped, or undefined if the group includes all models. */
  public models?: Id64Array;
  /** The clip to apply to the group of models. `undefined` indicates the models are exempt from clipping. */
  public clip?: ClipVector;

  private constructor(models: Id64Array | undefined, clip: ClipVector | undefined) {
    this.models = models;
    this.clip = clip;
  }

  /** Create a new ModelClipGroup. The input arrays are captured as references. */
  public static create(clip: ClipVector | undefined, models?: Id64Array): ModelClipGroup {
    return new ModelClipGroup(models, clip);
  }

  /** Create a deep copy of this group. */
  public clone(): ModelClipGroup {
    const models = this.models ? [ ...this.models ] : undefined;
    return new ModelClipGroup(models, this.clip?.clone());
  }

  /** Returns whether the specified model Id belongs to this group. */
  public includesModel(modelId: Id64String): boolean {
    return undefined === this.models || this.models.includes(modelId);
  }

  /** @internal */
  public static fromJSON(props: ModelClipGroupProps): ModelClipGroup {
    const models = props.models ? [ ...props.models ] : undefined;
    const clip = props.clip ? ClipVector.fromJSON(props.clip) : undefined;
    return new ModelClipGroup(models, undefined !== clip && clip.isValid ? clip : undefined);
  }

  /** @internal */
  public toJSON(): ModelClipGroupProps {
    const props: ModelClipGroupProps = { };
    if (this.models)
      props.models = [ ...this.models ];

    if (this.clip)
      props.clip = this.clip.toJSON();

    return props;
  }
}

/** Describes how to clip groups of models in the context of a [ViewDefinition3d]($backend).
 * Each group will be clipped by the [ClipVector]($geometry-core) associated with the group to which it belongs.
 * A model belongs to the first group in the list for which `ModelClipGroup.includesModel()` returns `true`.
 * A catch-all group can be defined by a ModelClipGroup with an `undefined` array of model Ids; any model whose Id does not appear in any group's list would belong to this group. If a catch-all group exists, it should appear last in the list.
 * A group of models can be exempted from clipping by a ModelClipGroup with an `undefined` ClipVector.
 * @note A ModelClipGroups obtained from a [[ViewDetails3d]] should **not** be modified directly. Clone it instead and modify the clone.
 * @see [[ViewDetails3d.modelClipGroups]].
 * @alpha
 */
export class ModelClipGroups {
  /** The groups of models. */
  public readonly groups: ModelClipGroup[];

  /** Create a new ModelClipGroups.
   * @note The ModelClipGroup takes ownership of the input array.
   */
  public constructor(groups: ModelClipGroup[] = []) {
    this.groups = groups;
  }

  /** Create a deep copy of this ModelClipGroups. */
  public clone(): ModelClipGroups {
    const groups = this.groups.map((group) => group.clone());
    return new ModelClipGroups(groups);
  }

  /** Find the first group to which the specified model Id belongs, if any. */
  public findGroup(modelId: Id64String): ModelClipGroup | undefined {
    return this.groups.find((group) => group.includesModel(modelId));
  }

  /** Returns the array index of the group to which the specified model belongs, or -1 if the model belongs to no group. */
  public findGroupIndex(modelId: Id64String): number {
    return this.groups.findIndex((group) => group.includesModel(modelId));
  }

  /** Find the clip that should be applied to the specified model.
   * @note This may return `undefined` if the model belongs to no group, **or** it belongs to a group that should not be clipped.
   */
  public getClipForModel(modelId: Id64String): ClipVector | undefined {
    return this.findGroup(modelId)?.clip;
  }

  /** @internal */
  public static fromJSON(props: ModelClipGroupProps[] | undefined): ModelClipGroups {
    const groups = props?.map((prop) => ModelClipGroup.fromJSON(prop));
    return new ModelClipGroups(groups);
  }

  /** @internal */
  public toJSON(): ModelClipGroupProps[] {
    return this.groups.map((group) => group.toJSON());
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
