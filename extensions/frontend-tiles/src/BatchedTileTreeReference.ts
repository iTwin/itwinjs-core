/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, FeatureAppearance, FeatureAppearanceProvider, FeatureAppearanceSource, GeometryClass, RenderSchedule,
} from "@itwin/core-common";
import {
  AnimationNodeId, formatAnimationBranchId, SceneContext, TileDrawArgs, TileTree, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { BatchedModels } from "./BatchedModels";
import { BatchedTileTree } from "./BatchedTileTree";

/** @internal */
export abstract class BatchedTileTreeReference extends TileTreeReference {
  protected readonly _treeOwner: TileTreeOwner;

  protected constructor(treeOwner: TileTreeOwner) {
    super();
    this._treeOwner = treeOwner;
  }

  public override get treeOwner(): TileTreeOwner {
    return this._treeOwner;
  }

  public get batchedTree(): BatchedTileTree | undefined {
    const tree = this._treeOwner.tileTree;
    assert(undefined === tree || tree instanceof BatchedTileTree);
    return tree;
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

export class PrimaryBatchedTileTreeReference extends BatchedTileTreeReference implements FeatureAppearanceProvider {
  private readonly _models: BatchedModels;

  public constructor(treeOwner: TileTreeOwner, models: BatchedModels) {
    super(treeOwner);
    this._models = models;
  }

  public override unionFitRange(range: Range3d): void {
    this._models.unionRange(range);
  }

  public override getAppearanceProvider(): FeatureAppearanceProvider | undefined {
    return this;
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
    if (!this._models.isViewed(modelLo, modelHi))
      return undefined;

    return source.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }

  public override getAnimationTransformNodeId() {
    return AnimationNodeId.Untransformed;
  }
}

export interface AnimationNode {
  readonly timeline: RenderSchedule.ModelTimeline;
  readonly nodeId: number;
  getCurrentTimePoint(): number;
}

export class AnimatedBatchedTileTreeReference extends BatchedTileTreeReference {
  private readonly _node: AnimationNode;
  private readonly _branchId: string;

  public constructor(treeOwner: TileTreeOwner, node: AnimationNode) {
    super(treeOwner);
    this._node = node;
    this._branchId = formatAnimationBranchId(node.timeline.modelId, node.nodeId);
  }

  public override getAnimationTransformNodeId(): number {
    return this._node.nodeId;
  }

  public override computeBaseTransform(tree: TileTree): Transform {
    const tf = super.computeBaseTransform(tree);
    const animTf = this._node.timeline.getTransform(this._node.nodeId, this._node.getCurrentTimePoint());
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
