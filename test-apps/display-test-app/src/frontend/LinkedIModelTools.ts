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

/** Attaches an iModel to the active viewport, with all non-private models and categories visible.
 * Only works for spatial views.
 */
export class LinkIModelTool extends Tool {
  public static override toolId = "LinkIModel";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.iModelRefs.isSpatial) {
      return false;
    }

    const fileName = await DisplayTestApp.surface.selectFileName();
    if (undefined === fileName)
      return false;

    let iModel;
    try {
      iModel = await BriefcaseConnection.openFile( { fileName, key: fileName });

      const viewedCategories = [];
      for await (const row of iModel.createQueryReader("SELECT ECInstanceId FROM BisCore.SpatialCategory"))
        viewedCategories.push(row.id);

      const viewedModels = [];
      for await (const row of iModel.createQueryReader("SELECT ECInstanceId FROM BisCore.SpatialModel"))
        viewedModels.push(row.id);

      vp.view.iModelRefs.link({
        iModel,
        viewedCategories,
        viewedModels,
        overrides: {
        },
      })
      return true;
    } catch (err: any) {
      alert(err.toString());
      return false;
    }
  }
}

/** Unlinks all iModels from the active viewport. */
export class UnlinkIModelsTool extends Tool {
  public static override toolId = "UnlinkIModels";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    for (const ref of vp.iModelRefs.linked) {
      vp.iModelRefs.unlink(ref);
    }

    return true;
  }
}
