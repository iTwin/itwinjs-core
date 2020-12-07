/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareStrings, Id64String } from "@bentley/bentleyjs-core";
import { Range3d, Transform } from "@bentley/geometry-core";
import { BatchType, compareIModelTileTreeIds, iModelTileTreeIdToString, PrimaryTileTreeId, ViewFlagOverrides } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { GeometricModelState } from "../ModelState";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { SceneContext } from "../ViewContext";
import { ViewState, ViewState3d } from "../ViewState";
import { RenderScheduleState } from "../RenderScheduleState";
import { InteractiveEditingSession } from "../InteractiveEditingSession";
import {
  IModelTileTree, IModelTileTreeParams, iModelTileTreeParamsFromJSON, TileDrawArgs, TileGraphicType, TileTree, TileTreeOwner, TileTreeReference,
  TileTreeSupplier,
} from "./internal";

interface PrimaryTreeId {
  readonly treeId: PrimaryTileTreeId;
  readonly modelId: Id64String;
  readonly is3d: boolean;
  readonly isPlanProjection: boolean;
}

class PlanProjectionTileTree extends IModelTileTree {
  public readonly baseElevation: number;

  public constructor(params: IModelTileTreeParams, baseElevation: number) {
    super(params);
    this.baseElevation = baseElevation;
  }
}

class PrimaryTreeSupplier implements TileTreeSupplier {
  public constructor() {
    InteractiveEditingSession.onBegin.addListener((session) => {
      session.onEnded.addOnce((sesh) => {
        assert(sesh === session);
        this.onSessionEnd(session);
      });
    });
  }

  public compareTileTreeIds(lhs: PrimaryTreeId, rhs: PrimaryTreeId): number {
    // NB: we don't compare isPlanProjection or is3d - they should always have the same value for a given modelId.
    let cmp = compareStrings(lhs.modelId, rhs.modelId);
    if (0 === cmp) {
      cmp = compareIModelTileTreeIds(lhs.treeId, rhs.treeId);
    }

    return cmp;
  }

  public async createTileTree(id: PrimaryTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const treeId = id.treeId;
    const idStr = iModelTileTreeIdToString(id.modelId, treeId, IModelApp.tileAdmin);
    const props = await iModel.tiles.getTileTreeProps(idStr);

    const options = {
      edgesRequired: treeId.edgesRequired,
      allowInstancing: undefined === treeId.animationId && !treeId.enforceDisplayPriority,
      is3d: id.is3d,
      batchType: BatchType.Primary,
    };

    const params = iModelTileTreeParamsFromJSON(props, iModel, id.modelId, options);
    if (!id.isPlanProjection)
      return new IModelTileTree(params);

    let elevation = 0;
    try {
      const ranges = await iModel.models.queryModelRanges(id.modelId);
      if (1 === ranges.length) {
        const range = Range3d.fromJSON(ranges[0]);
        const lo = range.low.z;
        const hi = range.high.z;
        if (lo <= hi)
          elevation = (lo + hi) / 2;
      }
    } catch (_err) {
      //
    }

    return new PlanProjectionTileTree(params, elevation);
  }

  public getOwner(id: PrimaryTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(id, this);
  }

  private onSessionEnd(session: InteractiveEditingSession): void {
    // Reset tile trees for any models that were modified during the session.
    const changes = session.getGeometryChanges();
    const trees = session.iModel.tiles.getTreeOwnersForSupplier(this);
    for (const kvp of trees) {
      const id = kvp.id as PrimaryTreeId;
      assert(undefined !== id.modelId);
      for (const change of changes) {
        if (change.id === id.modelId) {
          kvp.owner.dispose();
          break;
        }
      }
    }
  }
}

const primaryTreeSupplier = new PrimaryTreeSupplier();

class PrimaryTreeReference extends TileTreeReference {
  protected readonly _view: ViewState;
  protected readonly _model: GeometricModelState;
  protected readonly _viewFlagOverrides: ViewFlagOverrides;
  protected _id: PrimaryTreeId;
  private _owner: TileTreeOwner;

  public constructor(view: ViewState, model: GeometricModelState, isPlanProjection: boolean, transformNodeId?: number) {
    super();
    this._view = view;
    this._model = model;
    this._viewFlagOverrides = ViewFlagOverrides.fromJSON(model.jsonProperties.viewFlagOverrides);
    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: this.createTreeId(view, model.id, transformNodeId),
      isPlanProjection,
    };

    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  protected getViewFlagOverrides(_tree: TileTree) {
    return this._viewFlagOverrides;
  }

  public get castsShadows() {
    return true;
  }

  public get isPrimary() {
    return true;
  }

  protected getClipVolume(_tree: TileTree): RenderClipVolume | undefined {
    // ###TODO: reduce frequency with which getModelClip() is called
    return this._view.is3d() ? this._view.getModelClip(this._model.id) : undefined;
  }

  public get treeOwner(): TileTreeOwner {
    const newId = this.createTreeId(this._view, this._id.modelId, this._id.treeId.animationTransformNodeId);
    if (0 !== compareIModelTileTreeIds(newId, this._id.treeId)) {
      this._id = {
        modelId: this._id.modelId,
        is3d: this._id.is3d,
        treeId: newId,
        isPlanProjection: this._id.isPlanProjection,
      };

      this._owner = primaryTreeSupplier.getOwner(this._id, this._model.iModel);
    }

    return this._owner;
  }

  protected createTreeId(view: ViewState, modelId: Id64String, animationTransformNodeId: number | undefined): PrimaryTileTreeId {
    const script = view.scheduleScript;
    const animationId = undefined !== script ? script.getModelAnimationId(modelId) : undefined;
    const edgesRequired = true === IModelApp.tileAdmin.alwaysRequestEdges || this._viewFlagOverrides.edgesRequired(view.viewFlags);
    return { type: BatchType.Primary, edgesRequired, animationId, animationTransformNodeId };
  }

  protected computeBaseTransform(tree: TileTree): Transform {
    return super.computeTransform(tree);
  }

  protected computeTransform(tree: TileTree): Transform {
    const tf = this.computeBaseTransform(tree);
    return this._view.getModelDisplayTransform(this._model.id, tf);
  }
}

/** @internal */
export class AnimatedTreeReference extends PrimaryTreeReference {
  protected computeBaseTransform(tree: TileTree): Transform {
    const tf = super.computeBaseTransform(tree);
    const style = this._view.displayStyle;
    const script = style.scheduleScript;
    if (undefined === script || undefined === this._id.treeId.animationTransformNodeId)
      return tf;

    const timePoint = style.settings.timePoint ?? script.getCachedDuration().low;
    const animTf = script.getTransform(this._id.modelId, this._id.treeId.animationTransformNodeId, timePoint);
    if (animTf)
      animTf.multiplyTransformTransform(tf, tf);

    return tf;
  }
}

class PlanProjectionTreeReference extends PrimaryTreeReference {
  private get _view3d() { return this._view as ViewState3d; }
  private _curTransform?: { transform: Transform, elevation: number };

  public constructor(view: ViewState3d, model: GeometricModelState) {
    super(view, model, true);
    this._viewFlagOverrides.setForceSurfaceDiscard(true);
  }

  public get castsShadows() {
    return false;
  }

  public createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined !== args && this._id.treeId.enforceDisplayPriority) {
      args.drawGraphics = () => { // eslint-disable-line @typescript-eslint/unbound-method
        const graphics = args.produceGraphics();
        if (undefined !== graphics) {
          const settings = this.getSettings();
          const asOverlay = undefined !== settings && settings.overlay;
          const transparency = settings?.transparency || 0;

          assert(undefined !== this._curTransform);
          context.outputGraphic(context.target.renderSystem.createGraphicLayerContainer(graphics, asOverlay, transparency, this._curTransform.elevation));
        }
      };
    }

    return args;
  }

  protected computeBaseTransform(tree: TileTree): Transform {
    assert(tree instanceof PlanProjectionTileTree);
    const baseElevation = tree.baseElevation;
    if (undefined === this._curTransform)
      this._curTransform = { transform: tree.iModelTransform.clone(), elevation: baseElevation };

    const settings = this.getSettings();
    const elevation = settings?.elevation ?? baseElevation;

    if (this._curTransform.elevation !== elevation) {
      const transform = tree.iModelTransform.clone();
      if (undefined !== settings?.elevation)
        transform.origin.z = elevation;

      this._curTransform.transform = transform;
      this._curTransform.elevation = elevation;
    }

    return this._curTransform.transform;
  }

  public draw(args: TileDrawArgs): void {
    const settings = this.getSettings();
    if (undefined === settings || settings.enforceDisplayPriority || !settings.overlay)
      super.draw(args);
    else
      args.context.withGraphicType(TileGraphicType.Overlay, () => args.tree.draw(args));
  }

  private getSettings() {
    return this._view3d.getDisplayStyle3d().settings.getPlanProjectionSettings(this._model.id);
  }

  protected createTreeId(view: ViewState, modelId: Id64String): PrimaryTileTreeId {
    const id = super.createTreeId(view, modelId, undefined);
    const settings = this.getSettings();
    if (undefined !== settings && settings.enforceDisplayPriority)
      id.enforceDisplayPriority = true;

    return id;
  }
}

/** @internal */
export function createPrimaryTileTreeReference(view: ViewState, model: GeometricModelState): TileTreeReference {
  if (false !== IModelApp.renderSystem.options.planProjections) {
    const model3d = view.is3d() ? model.asGeometricModel3d : undefined;
    if (undefined !== model3d && model3d.isPlanProjection)
      return new PlanProjectionTreeReference(view as ViewState3d, model);
  }

  return new PrimaryTreeReference(view, model, false);
}

/** Append to the input list [[TileTreeReference]]s for any animation transforms applied to the model by the schedule script.
 * @internal
 */
export function addAnimatedTileTreeReferences(refs: TileTreeReference[], view: ViewState, model: GeometricModelState, script: RenderScheduleState.Script): void {
  const nodeIds = script.getTransformNodeIds(model.id);
  if (nodeIds)
    for (const nodeId of nodeIds)
      refs.push(new AnimatedTreeReference(view, model, false, nodeId));
}
