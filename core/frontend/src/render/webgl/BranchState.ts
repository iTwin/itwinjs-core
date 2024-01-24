/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Id64String } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import {
  BatchType, FeatureAppearance, FeatureAppearanceProvider, GeometryClass, HiddenLine, RealityModelDisplaySettings, RenderMode, ViewFlags,
} from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { FeatureSymbology } from "../FeatureSymbology";
import { ClipVolume } from "./ClipVolume";
import { Branch } from "./Graphic";
import { PlanarClassifier } from "./PlanarClassifier";
import { TextureDrape } from "./TextureDrape";
import { EdgeSettings } from "./EdgeSettings";

/** Options used to construct a BranchState.
 * @internal
 */
export interface BranchStateOptions {
  readonly transform: Transform;
  viewFlags: ViewFlags;
  symbologyOverrides: FeatureSymbology.Overrides;
  clipVolume?: ClipVolume;
  readonly planarClassifier?: PlanarClassifier;
  readonly secondaryClassifiers?: PlanarClassifier[];
  readonly textureDrape?: TextureDrape;
  readonly edgeSettings: EdgeSettings;
  /** Used chiefly for readPixels() to identify context of picked Ids when graphics from multiple iModels are displayed together. */
  readonly iModel?: IModelConnection;
  /** Whether the graphics in this branch are 2d or 3d.
   * Sometimes we draw 3d orthographic views in the context of a 2d view (e.g., sheet view attachments).
   * Currently this only affects the logic for discarding surfaces (in 2d, we relay on display priority to enforce draw order between different elements;
   * in 3d we use the pick buffers.
   */
  is3d: boolean;
  frustumScale?: { x: number, y: number };
  readonly appearanceProvider?: FeatureAppearanceProvider;
  readonly realityModelDisplaySettings?: RealityModelDisplaySettings;
  forceViewCoords?: boolean;
  readonly viewAttachmentId?: Id64String;
  groupNodeId?: number;
}

/**
 * Represents a branch node in the scene graph, with associated view flags and transform to be applied to
 * all sub-nodes of the branch.
 * @internal
 */
export class BranchState {
  private readonly _opts: BranchStateOptions;

  public get transform() { return this._opts.transform; }
  public get viewFlags() { return this._opts.viewFlags; }
  public set viewFlags(vf: ViewFlags) { this._opts.viewFlags = vf.normalize(); }
  public get clipVolume() { return this._opts.clipVolume; }
  public get forceViewCoords(): boolean { return true === this._opts.forceViewCoords; }
  public get planarClassifier() { return this._opts.planarClassifier; }
  public get textureDrape() { return this._opts.textureDrape; }
  public get edgeSettings() { return this._opts.edgeSettings; }
  public get iModel() { return this._opts.iModel; }
  public get is3d() { return this._opts.is3d; }
  public get frustumScale() { return this._opts.frustumScale!; }
  public get appearanceProvider() { return this._opts.appearanceProvider; }
  public get secondaryClassifiers() { return this._opts.secondaryClassifiers; }
  public get realityModelDisplaySettings() { return this._opts.realityModelDisplaySettings; }
  public get viewAttachmentId() { return this._opts.viewAttachmentId; }
  public get groupNodeId() { return this._opts.groupNodeId; }

  public get symbologyOverrides() {
    return this._opts.symbologyOverrides;
  }
  public set symbologyOverrides(ovrs: FeatureSymbology.Overrides) {
    this._opts.symbologyOverrides = ovrs;
  }

  public changeRenderPlan(viewFlags: ViewFlags, is3d: boolean, hline: HiddenLine.Settings | undefined): void {
    this.viewFlags = viewFlags;
    this._opts.is3d = is3d;
    this.edgeSettings.init(hline);
  }

  /** Create a BranchState from a Branch. Any properties not explicitly specified by the new Branch are inherited from the previous BranchState. */
  public static fromBranch(prev: BranchState, branch: Branch): BranchState {
    return new BranchState({
      viewFlags: branch.branch.getViewFlags(prev.viewFlags),
      transform: prev.transform.multiplyTransformTransform(branch.localToWorldTransform),
      symbologyOverrides: branch.branch.symbologyOverrides ?? prev.symbologyOverrides,
      iModel: branch.iModel ?? prev.iModel,
      planarClassifier: (undefined !== branch.planarClassifier && undefined !== branch.planarClassifier.texture) ? branch.planarClassifier : prev.planarClassifier,
      textureDrape: branch.textureDrape ?? prev.textureDrape,
      clipVolume: branch.clips,
      forceViewCoords: prev.forceViewCoords,
      edgeSettings: branch.edgeSettings ?? prev.edgeSettings,
      is3d: branch.frustum?.is3d ?? prev.is3d,
      frustumScale: branch.frustum?.scale ?? prev.frustumScale,
      secondaryClassifiers: branch.secondaryClassifiers?? prev.secondaryClassifiers,
      // The branch can augment the symbology overrides. If it doesn't want to, allow its parent to do so, unless this branch supplies its own symbology overrides.
      appearanceProvider: branch.appearanceProvider ?? (branch.branch.symbologyOverrides ? undefined : prev.appearanceProvider),
      realityModelDisplaySettings: branch.branch.realityModelDisplaySettings ?? prev.realityModelDisplaySettings,
      viewAttachmentId: branch.viewAttachmentId ?? prev.viewAttachmentId,
      groupNodeId: branch.branch.groupNodeId ?? prev.groupNodeId,
    });
  }

  public getFeatureAppearance(overrides: FeatureSymbology.Overrides, elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number): FeatureAppearance | undefined {
    if (this._opts.appearanceProvider)
      return this._opts.appearanceProvider.getFeatureAppearance(overrides, elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);

    return overrides.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }

  public static createForDecorations(): BranchState {
    const viewFlags = new ViewFlags({ renderMode: RenderMode.SmoothShade, lighting: false, whiteOnWhiteReversal: false });
    const symbologyOverrides = new FeatureSymbology.Overrides();
    symbologyOverrides.ignoreSubCategory = true;
    return new BranchState({
      viewFlags,
      transform: Transform.createIdentity(),
      symbologyOverrides,
      edgeSettings: EdgeSettings.create(undefined),
      is3d: true,
    });
  }

  public withViewCoords(): BranchState {
    return new BranchState({ ...this._opts, forceViewCoords: true });
  }

  public constructor(opts: BranchStateOptions) {
    if (!opts.frustumScale)
      opts.frustumScale = { x: 1, y: 1 };

    this._opts = opts;
    this._opts.viewFlags = this._opts.viewFlags.normalize();
  }
}
