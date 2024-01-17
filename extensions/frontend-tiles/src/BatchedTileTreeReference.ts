/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, FeatureAppearance, FeatureAppearanceProvider, FeatureAppearanceSource, GeometryClass, ViewFlagOverrides,
} from "@itwin/core-common";
import {
  formatAnimationBranchId, RenderClipVolume, SceneContext, TileDrawArgs, TileGraphicType, TileTree, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { BatchedModels } from "./BatchedModels";
import { ModelGroupInfo } from "./ModelGroup";

export interface BatchedTileTreeReferenceArgs {
  readonly models: BatchedModels;
  readonly groups: ReadonlyArray<ModelGroupInfo>;
  readonly treeOwner: TileTreeOwner;
  readonly getCurrentTimePoint: () => number;
}

export class BatchedTileTreeReference extends TileTreeReference implements FeatureAppearanceProvider {
  private readonly _args: BatchedTileTreeReferenceArgs;
  private readonly _groupIndex: number;
  private readonly _animationNodeId?: number;
  private readonly _branchId?: string;

  public constructor(args: BatchedTileTreeReferenceArgs, groupIndex: number, animationNodeId: number | undefined) {
    super();
    this._args = args;
    this._groupIndex = groupIndex;
    this._animationNodeId = animationNodeId;
    if (undefined !== animationNodeId) {
      assert(undefined !== this._groupInfo.timeline);
      this._branchId = formatAnimationBranchId(this._groupInfo.timeline.modelId, animationNodeId);
    }
  }

  private get _groupInfo(): ModelGroupInfo {
    assert(this._groupIndex < this._args.groups.length);
    return this._args.groups[this._groupIndex];
  }

  public override get treeOwner(): TileTreeOwner {
    return this._args.treeOwner;
  }

  public override getAppearanceProvider(): FeatureAppearanceProvider {
    return this;
  }

  protected override getClipVolume(): RenderClipVolume | undefined {
    return this._groupInfo.clip;
  }

  public getFeatureAppearance(
    source: FeatureAppearanceSource,
    elemLo: number, elemHi: number,
    subcatLo: number, subcatHi: number,
    geomClass: GeometryClass,
    modelLo: number, modelHi: number,
    type: BatchType,
    animationNodeId: number,
  ): FeatureAppearance | undefined {
    if (!this._args.models.isViewed(modelLo, modelHi))
      return undefined;

    return source.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }

  public override unionFitRange(range: Range3d): void {
    this._args.models.unionRange(range);
  }

  public override get castsShadows(): boolean {
    if (this._groupInfo.planProjection)
      return false;

    return super.castsShadows;
  }

  public override getViewFlagOverrides(): ViewFlagOverrides {
    return this._groupInfo.viewFlags;
  }

  public override draw(args: TileDrawArgs): void {
    if (this._groupInfo.planProjection?.overlay)
      args.context.withGraphicType(TileGraphicType.Overlay, () => args.tree.draw(args));
    else
      super.draw(args);
  }

  protected override computeTransform(tree: TileTree): Transform {
    const group = this._groupInfo;
    let baseTf = super.computeTransform(tree);

    if (group.planProjection) {
      baseTf = baseTf.clone();
      baseTf.origin.z += group.planProjection.elevation;
    }

    if (group.timeline) {
      assert(undefined !== this._animationNodeId);
      const animTf = group.timeline.getTransform(this._animationNodeId, this._args.getCurrentTimePoint());
      if (animTf)
        animTf.multiplyTransformTransform(baseTf, baseTf);
    }

    const displayTf = group.displayTransform;
    if (!displayTf)
      return baseTf;

    return displayTf.premultiply ? displayTf.transform.multiplyTransformTransform(baseTf) : baseTf.multiplyTransformTransform(displayTf.transform);
  }

  protected override getAnimationTransformNodeId() {
    return this._animationNodeId;
  }

  protected override getGroupNodeId() {
    return this._args.groups.length > 1 ? this._groupIndex : undefined;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    if (this._branchId) {
      const branch = context.viewport.target.animationBranches?.branchStates.get(this._branchId);
      if (branch?.omit) {
        // This branch is not supposed to be drawn
        return undefined;
      }
    }

    const args = super.createDrawArgs(context);

    // ###TODO args.boundingRange = args.tree.getTransformNodeRange(this._animationTransformNodeId);
    // ###TODO if PlanProjectionSettings.enforceDisplayPriority, createGraphicLayerContainer.

    return args;
  }
}
