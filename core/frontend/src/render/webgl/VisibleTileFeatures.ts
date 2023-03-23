/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Id64 } from "@itwin/core-bentley";
import { BatchType, PackedFeature } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { QueryTileFeaturesOptions, VisibleFeature } from "../VisibleFeature";
import { RenderPass } from "./RenderFlags";
import { RenderCommands } from "./RenderCommands";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target } from "./Target";

/** Iterates over features visible in tiles selected for display by a Target by inspecting its RenderCommands.
 * @internal
 */
export class VisibleTileFeatures implements Iterable<VisibleFeature> {
  public readonly includeNonLocatable: boolean;
  public readonly renderCommands: RenderCommands;
  public readonly target: Target;
  public readonly iModel: IModelConnection;

  public constructor(commands: RenderCommands, options: QueryTileFeaturesOptions, target: Target, iModel: IModelConnection) {
    this.includeNonLocatable = true === options.includeNonLocatable;
    this.renderCommands = commands;
    this.target = target;
    this.iModel = iModel;

    target.compositor.preDraw();
  }

  public [Symbol.iterator](): Iterator<VisibleFeature> {
    return iterator(this);
  }
}

const clippedPasses: RenderPass[] = [
  RenderPass.BackgroundMap,
  RenderPass.OpaqueLayers,
  RenderPass.OpaqueLinear,
  RenderPass.OpaquePlanar,
  RenderPass.OpaqueGeneral,
  RenderPass.TranslucentLayers,
  RenderPass.Translucent,
  RenderPass.OverlayLayers,
];

function isFeatureVisible(feature: PackedFeature, target: Target, includeNonLocatable: boolean) {
  const ovrs = target.currentFeatureSymbologyOverrides;
  if (!ovrs)
    return true;

  const app = target.currentBranch.getFeatureAppearance(
    ovrs,
    feature.elementId.lower, feature.elementId.upper,
    feature.subCategoryId.lower, feature.subCategoryId.upper,
    feature.geometryClass,
    feature.modelId.lower, feature.modelId.upper,
    BatchType.Primary, feature.animationNodeId);

  return undefined !== app && (includeNonLocatable || !app.nonLocatable);
}

function* commandIterator(features: VisibleTileFeatures, pass: RenderPass) {
  const commands = features.renderCommands.getCommands(pass);
  const executor = new ShaderProgramExecutor(features.target, pass);
  try {
    for (const command of commands) {
      if (command.opcode !== "drawPrimitive")
        command.execute(executor);

      if (command.opcode !== "pushBatch")
        continue;

      const ovrs = command.batch.getOverrides(features.target);
      if (ovrs.allHidden)
        continue;

      const scratchFeature = PackedFeature.createWithIndex();
      const table = command.batch.featureTable;
      for (const feature of table.iterable(scratchFeature)) {
        if (!ovrs.anyOverridden || isFeatureVisible(feature, features.target, features.includeNonLocatable)) {
          yield {
            elementId: Id64.fromUint32PairObject(feature.elementId),
            subCategoryId: Id64.fromUint32PairObject(feature.subCategoryId),
            geometryClass: feature.geometryClass,
            modelId: Id64.fromUint32PairObject(feature.modelId),
            iModel: command.batch.batchIModel ?? features.iModel,
          };
        }
      }
    }
  } finally {
    executor.dispose();
  }
}

function* iterator(features: VisibleTileFeatures) {
  try {
    features.target.pushViewClip();
    for (const pass of clippedPasses)
      yield* commandIterator(features, pass);
  } finally {
    features.target.popViewClip();
  }
}
