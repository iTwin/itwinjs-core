/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BriefcaseConnection,
  FeatureSymbology, IModelApp, IModelConnection, SceneContext, TiledGraphicsProvider, TileTreeReference, Tool, ViewCreator3d, Viewport, ViewState,
} from "@itwin/core-frontend";
import { DisplayTestApp } from "./App";

class Provider implements TiledGraphicsProvider {
  private readonly _view: ViewState;
  private readonly _ovrs: FeatureSymbology.Overrides;

  public get iModel() { return this._view.iModel; }

  private constructor(view: ViewState) {
    this._view = view;

    // These overrides ensure that all of the categories and subcategories in the secondary iModel are displayed.
    // Any symbology overrides applied to the viewport are ignored.
    this._ovrs = new FeatureSymbology.Overrides(view);
  }

  public forEachTileTreeRef(_vp: Viewport, func: (ref: TileTreeReference) => void): void {
    this._view.forEachTileTreeRef(func);
  }

  public addToScene(context: SceneContext): void {
    // We only need to override this so that we can apply our symbology overrides.
    this._view.forEachTileTreeRef((ref) => {
      const tree = ref.treeOwner.load();
      if (!tree) {
        return;
      }

      const args = ref.createDrawArgs(context);
      if (!args) {
        return;
      }

      tree.draw(args);

      args.graphics.symbologyOverrides = this._ovrs;
      const branch = context.createBranch(args.graphics, args.location);
      context.outputGraphic(branch);
    });
  }

  public static async create(iModel: IModelConnection): Promise<Provider> {
    const creator = new ViewCreator3d(iModel);
    const view = await creator.createDefaultView();
    return new Provider(view);
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
    const provider = await Provider.create(iModel);
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
