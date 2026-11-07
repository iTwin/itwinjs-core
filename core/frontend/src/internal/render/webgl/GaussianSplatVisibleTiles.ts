/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Frustum, FrustumPlanes, PackedFeature } from "@itwin/core-common";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import type { IModelConnection } from "../../../IModelConnection";
import { GaussianSplatOccurrence } from "../GaussianSplatInstances";
import { BranchState } from "./BranchState";
import { ClipVolume } from "./ClipVolume";
import { DrawCommands, PopBatchCommand, PopBranchCommand, PopClipCommand, PopCommand, PrimitiveCommand, PushCommand } from "./DrawCommand";
import { FloatRgba } from "./FloatRGBA";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { Batch } from "./Graphic";
import { Target } from "./Target";

/** The uniform appearance of a splat tile occurrence: its opacity, and its color if overridden, in display space. @internal */
export interface GaussianSplatAppearance {
  alpha: number;
  rgb?: [number, number, number];
}

/** One occurrence of a splat tile drawn this frame: the state the native commands draw it with, and those commands, which
 * reproduce that state in a later frame.
 * @internal
 */
export interface GaussianSplatVisibleTile {
  geometry: GaussianSplatGeometry;
  occurrence: GaussianSplatOccurrence;
  /** From the tile's coordinates to eye coordinates. */
  modelView: Transform;
  /** Row-major affine transform from the tile's relative means to eye coordinates, as sorting and the shader use it. */
  transform: number[];
  appearance: GaussianSplatAppearance;
  /** The clip volumes the occurrence's branches apply, above the view clip. */
  clips: readonly ClipVolume[];
  /** The occurrence's branch disables the view's clip colors. */
  clipStyleDisabled: boolean;
  /** Bounds of the tile's splat means in eye coordinates. */
  eyeRange: Range3d;
  commands: DrawCommands;
  /** The iModel and model of the tile's batch, if it is batched; a viewport draws tile trees by model. */
  iModel?: IModelConnection;
  modelId?: Id64String;
}

/** The color space a splat tile was trained in, as the shader's tile metadata stores it. @internal */
export enum GaussianSplatColorSpace {
  /** `srgb_rec709_display` */
  Display = 0,
  /** `lin_rec709_display` */
  Linear = 1,
}

/** Whether `tile` was trained in linear color space; otherwise in display space (sRGB). @internal */
export function isLinearTrained(tile: GaussianSplatVisibleTile): boolean {
  return tile.geometry.splats.colorSpace === "lin_rec709_display";
}

/** Layout of a tile's metadata row, read as 11 RGBA32F texels. Texels 0-2: transform to eye coordinates;
 * 3: first clip plane, clip plane count, SH degree and color space; 4: alpha and override RGB (-1s if not overridden);
 * 5-6: inside and outside clip colors; 7-9: inverse rotation; 10: antialiasing, first SH texel and SH texels per splat.
 * Colors are in the tile's trained color space. @internal
 */
export const gaussianSplatTileMetadata = {
  /** Floats per row. */
  length: 44,
} as const;

/** Where the frame's upload placed a tile's clip planes and higher-band SH coefficients. @internal */
export interface GaussianSplatTileStorage {
  firstClipPlane: number;
  clipPlaneCount: number;
  firstShTexel: number;
}

/** A display-space (sRGB) color component in linear space. */
function linearFromDisplay(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Write `tile`'s metadata row (see [[gaussianSplatTileMetadata]]) into `metadata` from `offset`. @internal */
export function writeGaussianSplatTileMetadata(tile: GaussianSplatVisibleTile, clipColors: { inside: FloatRgba, outside: FloatRgba }, storage: GaussianSplatTileStorage, metadata: Float32Array, offset: number): void {
  const { splats } = tile.geometry;
  const linear = isLinearTrained(tile);
  const trained = (rgb: number[]) => linear ? rgb.map(linearFromDisplay) : rgb;
  const clipColor = (color: FloatRgba) => [...trained([color.red, color.green, color.blue]), tile.clipStyleDisabled ? 0 : color.alpha];
  const inverseRotation = tile.modelView.matrix.inverse()?.coffs ?? new Float64Array(9);
  const { appearance } = tile;
  metadata.set([
    ...tile.transform,
    storage.firstClipPlane, storage.clipPlaneCount, splats.shDegree, linear ? GaussianSplatColorSpace.Linear : GaussianSplatColorSpace.Display,
    appearance.alpha, ...(appearance.rgb ? trained(appearance.rgb) : [-1, -1, -1]),
    ...clipColor(clipColors.inside),
    ...clipColor(clipColors.outside),
    inverseRotation[0], inverseRotation[1], inverseRotation[2], 0,
    inverseRotation[3], inverseRotation[4], inverseRotation[5], 0,
    inverseRotation[6], inverseRotation[7], inverseRotation[8], 0,
    splats.antialiased ? 1 : 0, storage.firstShTexel, splats.sh.length / splats.count / 4, 0,
  ], offset);
}

/** The distinct geometries of `tiles`, in order of first occurrence. @internal */
export function gaussianSplatGeometriesOf(tiles: ReadonlyArray<{ geometry: GaussianSplatGeometry }>): GaussianSplatGeometry[] {
  return [...new Map(tiles.map((tile) => [tile.geometry.id, tile.geometry])).values()];
}

function popCommandFor(push: PushCommand): PopCommand {
  switch (push.opcode) {
    case "pushBatch": return PopBatchCommand.instance;
    case "pushClip": return PopClipCommand.instance;
    default: return PopBranchCommand.instance;
  }
}

/** What native drawing applies inside a push command: the branch state, the clip volumes pushed above the view clip, and the
 * active batch. Derived from the commands as the target's branch and batch uniforms derive them, without changing the target.
 */
interface CommandScope {
  push?: PushCommand;
  branch: BranchState;
  clips: readonly ClipVolume[];
  batch?: Batch;
}

function withClip(clips: readonly ClipVolume[], clip?: ClipVolume): readonly ClipVolume[] {
  return clip ? [...clips, clip] : clips;
}

function enterScope(scope: CommandScope, push: PushCommand): CommandScope {
  switch (push.opcode) {
    case "pushBranch": {
      const branch = BranchState.fromBranch(scope.branch, push.branch);
      return { push, branch, clips: withClip(scope.clips, branch.clipVolume), batch: scope.batch };
    }
    case "pushState":
      return { push, branch: push.state, clips: withClip(scope.clips, push.state.clipVolume), batch: scope.batch };
    case "pushClip":
      return { ...scope, push, clips: withClip(scope.clips, push.clip) };
    case "pushBatch":
      return { ...scope, push, batch: push.batch };
  }
}

/** Collect each splat primitive `commands` draw, with the transform, appearance and clip state it is drawn with, by walking the
 * commands' branch, batch and clip scopes from `target`'s current branch state. The target is not changed. `retained` commands
 * are a field stored from an earlier frame: they are culled against the current frustum.
 * @internal
 */
export function gatherGaussianSplatTiles(target: Target, commands: DrawCommands, retained = false): GaussianSplatVisibleTile[] {
  if (target.is2d)
    return [];

  const tiles: GaussianSplatVisibleTile[] = [];
  const cullingFrustum = retained ? FrustumPlanes.fromFrustum(target.planFrustum) : undefined;
  const scopes: CommandScope[] = [{ branch: target.currentBranch, clips: [] }];
  for (const command of commands) {
    switch (command.opcode) {
      case "drawPrimitive": {
        const tile = visibleTileOf(target, command, scopes, cullingFrustum);
        if (tile)
          tiles.push(tile);
        break;
      }
      case "popBranch":
      case "popBatch":
      case "popClip":
        scopes.pop();
        break;
      default:
        scopes.push(enterScope(scopes[scopes.length - 1], command));
    }
  }

  return tiles;
}

/** The opacity of a transparency override, quantized as the native feature overrides store it. */
function alphaOf(transparency?: number): number {
  if (undefined === transparency)
    return 1;

  const alpha = Math.floor(255 * (1 - transparency) + 0.5);
  return 255 - alpha < DisplayParams.minTransparency ? 1 : alpha / 255;
}

/** The appearance of `batch`'s features as `branch` resolves them (see FeatureOverrides), or undefined if all of them are hidden.
 * Only a uniform appearance applies: a splat tile has no per-feature data.
 */
function batchAppearance(batch: Batch | undefined, branch: BranchState): GaussianSplatAppearance | undefined {
  const features = batch?.featureTable;
  if (!features)
    return { alpha: 1 };

  const scratch = PackedFeature.createWithIndex();
  const appearances = [];
  for (const feature of features.iterable(scratch)) {
    appearances.push(branch.getFeatureAppearance(branch.symbologyOverrides, feature.elementId.lower, feature.elementId.upper,
      feature.subCategoryId.lower, feature.subCategoryId.upper, feature.geometryClass, feature.modelId.lower, feature.modelId.upper,
      features.type, feature.animationNodeId));
  }

  if (appearances.length > 0 && appearances.every((appearance) => !appearance))
    return undefined;

  const uniform = appearances.length === 1 ? appearances[0] : undefined;
  const rgb = uniform?.overridesRgb ? uniform.rgb : undefined;
  return { alpha: alphaOf(uniform?.transparency), rgb: rgb && [rgb.r / 255, rgb.g / 255, rgb.b / 255] };
}

/** The tile `command` draws within `scopes`, or undefined if it draws no visible splat tile. */
function visibleTileOf(target: Target, command: PrimitiveCommand, scopes: CommandScope[], cullingFrustum?: FrustumPlanes): GaussianSplatVisibleTile | undefined {
  const geometry = command.primitive.cachedGeometry;
  if (!(geometry instanceof GaussianSplatGeometry) || geometry.isDisposed)
    return undefined;

  const { branch, clips, batch } = scopes[scopes.length - 1];
  const range = geometry.computeRange();
  const clipStyleDisabled = true === branch.disableClipStyle;
  if (target.uniforms.branch.clipStack.isRangeClippedWith(range, branch.transform, clips, clipStyleDisabled))
    return undefined;

  const culled = cullingFrustum?.computeFrustumContainment(Frustum.fromRange(range).transformBy(branch.transform)) === FrustumPlanes.Containment.Outside;
  if (culled)
    return undefined;

  const appearance = batchAppearance(batch, branch);
  const modelView = target.uniforms.frustum.viewMatrix.multiplyTransformTransform(branch.transform);
  if (!appearance || !modelView.matrix.inverse())
    return undefined;

  const origin = modelView.multiplyPoint3d(Point3d.create(...geometry.splats.origin));
  const rotation = modelView.matrix.coffs;
  const transform = [
    rotation[0], rotation[1], rotation[2], origin.x,
    rotation[3], rotation[4], rotation[5], origin.y,
    rotation[6], rotation[7], rotation[8], origin.z,
  ];

  const pushes = scopes.flatMap((scope) => scope.push ?? []);
  return {
    geometry,
    occurrence: { geometryId: geometry.id, transform: branch.transform },
    modelView,
    transform,
    appearance,
    clips,
    clipStyleDisabled,
    eyeRange: modelView.multiplyRange(range),
    commands: [...pushes, command, ...pushes.slice().reverse().map(popCommandFor)],
    // Unbound decoration batches belong to the viewport's iModel.
    iModel: batch && (batch.batchIModel ?? target.screenSpaceEffectContext.viewport.iModel),
    modelId: batch?.featureTable.batchModelId,
  };
}
