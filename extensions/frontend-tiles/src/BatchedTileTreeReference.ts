/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, FeatureAppearance, FeatureAppearanceProvider, FeatureAppearanceSource, GeometryClass, ModelExtentsProps,
} from "@itwin/core-common";
import {
  AnimationNodeId, AttachToViewportArgs, formatAnimationBranchId, SceneContext, SpatialViewState, TileDrawArgs, TileTree, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { BatchedTileTreeId, getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";

/** @internal */
export class BatchedTileTreeReference extends TileTreeReference implements FeatureAppearanceProvider {
  private readonly _baseUrl: URL;
  protected readonly _view: SpatialViewState;
  private readonly _viewedModels = new Id64.Uint32Set();
  private readonly _modelRanges = new Map<Id64String, Range3d>();
  private _modelRangePromise?: Promise<void>;
  private _onModelSelectorChanged?: () => void;

  protected constructor(baseUrl: URL, view: SpatialViewState) {
    super();
    this._baseUrl = baseUrl;
    this._view = view;
  }

  public static create(view: SpatialViewState, baseUrl: URL): BatchedTileTreeReference {
    return new BatchedTileTreeReference(baseUrl, view);
  }

  public override get treeOwner(): TileTreeOwner {
    const script = this._view.displayStyle.scheduleScript;
    const id: BatchedTileTreeId = {
      script: script?.requiresBatching ? script : undefined,
      baseUrl: this._baseUrl,
    }

    return getBatchedTileTreeOwner(this._view.iModel, id);
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._onModelSelectorChanged = () => args.invalidateSymbologyOverrides();
    this.updateViewedModels();
  }

  public detachFromViewport(): void {
    this._onModelSelectorChanged = undefined;
  }

  public updateViewedModels(): void {
    this._viewedModels.clear();
    this._viewedModels.addIds(this._view.modelSelector.models);
    if (!this._onModelSelectorChanged) {
      // Don't bother updating model ranges if we're not attached to a viewport.
      return;
    }

    this._onModelSelectorChanged();

    this._modelRangePromise = undefined;
    const modelIds = Array.from(this._view.modelSelector.models).filter((modelId) => !this._modelRanges.has(modelId));
    if (modelIds.length === 0)
      return;

    const modelRangePromise = this._modelRangePromise = this._view.iModel.models.queryExtents(modelIds).then((extents: ModelExtentsProps[]) => {
      if (modelRangePromise !== this._modelRangePromise)
        return;

      this._modelRangePromise = undefined;
      for (const extent of extents)
        this._modelRanges.set(extent.id, Range3d.fromJSON(extent.extents));
    }).catch(() => { });
  }

  public override unionFitRange(union: Range3d): void {
    this._viewedModels.forEach((low: number, high: number) => {
      const id = Id64.fromUint32Pair(low, high);
      const extent = this._modelRanges.get(id);
      if (extent)
        union.extendRange(extent);
    });
  }

  public override getAppearanceProvider(): FeatureAppearanceProvider | undefined {
    return this._onModelSelectorChanged ? this : undefined;
  }

  public getFeatureAppearance(
    source: FeatureAppearanceSource,
    elemLo: number, elemHi: number,
    subcatLo: number, subcatHi: number,
    geomClass: GeometryClass,
    modelLo: number, modelHi: number,
    type: BatchType,
    animationNodeId: number
  ): FeatureAppearance | undefined {
    // ###TODO: Until MultiModelPackedFeatureTable is hooked up we'll always get the transient model Id - remove check after that.
    if (modelHi !== 0xffffff00 && !this._viewedModels.has(modelLo, modelHi))
      return undefined;

    return source.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }

  public override getAnimationTransformNodeId() {
    return AnimationNodeId.Untransformed;
  }

  protected computeBaseTransform(tree: TileTree): Transform {
    return super.computeTransform(tree);
  }

  protected override computeTransform(tree: TileTree): Transform {
    const baseTf = this.computeBaseTransform(tree);
    // ###TODO this.view.modelDisplayTransformProvider?.getModelDisplayTransform(modelId...)
    return baseTf;
  }
}

class AnimatedBatchedTileTreeReference extends BatchedTileTreeReference {
  private readonly _animationTransformNodeId: number;
  private readonly _modelId: Id64String;
  private readonly _branchId: string;

  public constructor(baseUrl: URL, view: SpatialViewState, transformNodeId: number, modelId: Id64String) {
    super(baseUrl, view);
    this._animationTransformNodeId = transformNodeId;
    this._modelId = modelId;
    this._branchId = formatAnimationBranchId(modelId, transformNodeId);
  }

  public override getAnimationTransformNodeId(): number {
    return this._animationTransformNodeId;
  }

  public override computeBaseTransform(tree: TileTree): Transform {
    const tf = super.computeBaseTransform(tree);
    const style = this._view.displayStyle;
    const script = style.scheduleScript;
    if (!script)
      return tf;

    const timePoint = style.settings.timePoint ?? script.duration.low;
    const animTf = script.getTransform(this._modelId, this._animationTransformNodeId, timePoint);
    if (animTf)
      animTf.multiplyTransformTransform(tf, tf);

    return tf;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const animBranch = context.viewport.target.animationBranches?.branchStates.get(this._branchId);
    if (animBranch && animBranch.omit)
      return undefined;

    const args = super.createDrawArgs(context);
    // ###TODO args.boundingRange = args.tree.getTransformNodeRange(this._animationTransformNodeId);
    return args;
  }
}
