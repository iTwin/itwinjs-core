/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  AmbientOcclusion, ColorDef, Environment, FeatureAppearance, PlanarClipMaskSettings, RealityDataSourceKey, RealityModelDisplaySettings, SolarShadowSettings, SpatialClassifiers, ViewFlags,
} from "@itwin/core-common";
import { ViewportDecorator } from "../../Viewport";
import { HitDetail } from "../../HitDetail";
import { SceneContext } from "../../ViewContext";
import { ContextRealityModelState } from "../../ContextRealityModelState";
import { IModelSpatialView, IModelView, IModelView2d } from "../IModelView";
import { TiledGraphicsProvider } from "../../tile/internal";
import { SceneVolume3d, TestSceneVolume2d } from "../SceneVolume";
import { GuidString, Id64String } from "@itwin/core-bentley";
import { RealityModelSceneObject } from "../SceneObject";
import { SpatialScene } from "../ViewportScene";
import { ModelClassifierParams, ModelClipMaskParams, SceneRealityModel, SceneObjectClassifiers } from "../SceneRealityModel";
import { SceneObjectImpl } from "./SceneObjectImpl";

export class RealityModelImpl implements SceneRealityModel {
  state: ContextRealityModelState;

  constructor(state: ContextRealityModelState) {
    this.state = state;
  }

  get sourceKey() { return this.state.rdSourceKey; }
  get name() { return this.state.name; }
  get description() { return this.state.description; }
  get realityDataId() { return this.state.realityDataId; }
  get appearanceOverrides() { return this.state.appearanceOverrides; }
  get displaySettings() { return this.state.displaySettings; }

  // ###TODO
  public readonly classifiers = { } as unknown as SceneObjectClassifiers;

  // ###TODO get/set clipMask
}

export class RealityModelSceneObjectImpl extends SceneObjectImpl<SpatialScene> implements RealityModelSceneObject {
  readonly realityModel: RealityModelImpl;

  constructor(realityModel: RealityModelImpl, scene: SpatialScene, guid: GuidString) {
    super(guid, scene);
    this.realityModel = realityModel;
  }

  override get isLoadingComplete(): boolean {
    return this.realityModel.state.treeRef.isLoadingComplete;
  }

  override get isGlobal(): boolean {
    return this.realityModel.state.isGlobal;
  }

  override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    return this.realityModel.state.treeRef.getToolTip(hit);
  }

  draw(context: SceneContext): void {
    this.realityModel.state.treeRef.addToScene(context);
  }
}
