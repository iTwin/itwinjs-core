/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BriefcaseConnection,
  FeatureSymbology, HitDetail, IModelApp, IModelConnection, TiledGraphicsProvider, TileTree, TileTreeReference, Tool, ViewCreator3d, Viewport, ViewState,
} from "@itwin/core-frontend";
import { DisplayTestApp } from "./App";
import { Transform } from "@itwin/core-geometry";

class Reference extends TileTreeReference {
  private readonly _ref: TileTreeReference;
  private readonly _provider: Provider;
  private _transform?: Promise<Transform> | Transform;

  public constructor(ref: TileTreeReference, provider: Provider) {
    super();
    this._ref = ref;
    this._provider = provider;
  }

  public override get castsShadows() { return this._ref.castsShadows; }
  public override get treeOwner() { return this._ref.treeOwner; }
  public override async getToolTip(hit: HitDetail) { return this._ref.getToolTip(hit); }
  public override canSupplyToolTip(hit: HitDetail) { return this._ref.canSupplyToolTip(hit); }
  public override getToolTipPromise(hit: HitDetail) { return this._ref.getToolTipPromise(hit); }

  protected override getSymbologyOverrides() { return this._provider.ovrs; }
  protected override computeTransform(tree: TileTree): Transform {
    if (!this._transform) {
      this._provider.computeTransform(tree).then((tf) => {
        this._provider.viewport.invalidateScene();
        this._transform = tf;
      })
    }

    return this._transform instanceof Transform ? this._transform : tree.iModelTransform;
  }
}

class Provider implements TiledGraphicsProvider {
  public readonly view: ViewState;
  public readonly ovrs: FeatureSymbology.Overrides;
  public readonly viewport: Viewport;
  public readonly fromViewport: Transform;
  private readonly _refs: Reference[];

  public get iModel() { return this.view.iModel; }

  private constructor(view: ViewState, vp: Viewport, transform: Transform) {
    this.view = view;
    this.viewport = vp;
    this.fromViewport = transform;

    // These overrides ensure that all of the categories and subcategories in the secondary iModel are displayed.
    // Any symbology overrides applied to the viewport are ignored.
    this.ovrs = new FeatureSymbology.Overrides(view);

    this._refs = [];
    view.forEachModelTreeRef((ref) => {
      this._refs.push(new Reference(ref, this));
    });
  }

  public forEachTileTreeRef(_vp: Viewport, func: (ref: TileTreeReference) => void): void {
    for (const ref of this._refs) {
      func(ref);
    }
  }

  public static async create(attachedIModel: IModelConnection, vp: Viewport): Promise<Provider> {
    const creator = new ViewCreator3d(attachedIModel);
    const view = await creator.createDefaultView();

    const transform = Transform.createIdentity();
    
    return new Provider(view, vp, transform);
  }

  public async computeTransform(tree: TileTree): Promise<Transform> {
    const ecefTransform = await tree.getEcefTransform();
    if (ecefTransform) {
      const worldTf = this.viewport.iModel.getEcefTransform().inverse();
      if (worldTf) {
        return worldTf.multiplyTransformTransform(ecefTransform);
      }
    }

    return tree.iModelTransform;
  }
}

const providersByViewport = new Map<Viewport, Provider>();

/** A simple proof-of-concept for drawing tiles from a different IModelConnection into a Viewport. */
export async function toggleExternalTiledGraphicsProvider(vp: Viewport): Promise<void> {
  const existing = providersByViewport.get(vp);
  if (undefined !== existing) {
    vp.dropTiledGraphicsProvider(existing);
    providersByViewport.delete(vp);
    await existing.iModel.close();
    return;
  }

  const fileName = await DisplayTestApp.surface.selectFileName();
  if (undefined === fileName)
    return;

  let iModel;
  try {
    iModel = await BriefcaseConnection.openFile( { fileName, key: fileName });
    const provider = await Provider.create(iModel, vp);
    providersByViewport.set(vp, provider);
    vp.addTiledGraphicsProvider(provider);
  } catch (err: any) {
    alert(err.toString());
    return;
  }
}

export class ToggleSecondaryIModelTool extends Tool {
  public static override toolId = "ToggleSecondaryIModel";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    await toggleExternalTiledGraphicsProvider(vp);
    return true;
  }
}
