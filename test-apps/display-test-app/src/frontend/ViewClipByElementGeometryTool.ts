/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ClipPrimitive, ClipVector, ConvexClipPlaneSet, UnionOfConvexClipPlaneSets,
} from "@itwin/core-geometry";
import {
  ElementMeshOptions, readElementMeshes,
} from "@itwin/core-common";
import {
  BeButtonEvent, CoordinateLockOverrides, EventHandled, IModelApp, LocateResponse, ViewClipTool, Viewport,
} from "@itwin/core-frontend";

interface Settings extends ElementMeshOptions {
  offset?: number;
}

// Out of laziness, settings are global.
const settings: Settings = {
  chordTolerance: 0.1,
};

export class ViewClipByElementGeometryTool extends ViewClipTool {
  public static override toolId = "DtaClipByElementGeometry";
  public static override iconSpec = "icon-section-element";

  public override async onPostInstall() {
    await super.onPostInstall();
    if (this.targetView && this.targetView.iModel.selectionSet.isActive) {
      await this.doClipToSelectedElements(this.targetView);
      return;
    }

    this.initLocateElements(true, false, "default", CoordinateLockOverrides.All);
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.targetView)
      return EventHandled.No;

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (!hit || !hit.isElementHit)
      return EventHandled.No;

    return await this.doClipToElements(this.targetView, new Set<string>([hit.sourceId])) ? EventHandled.Yes : EventHandled.No;
  }

  private async doClipToSelectedElements(viewport: Viewport): Promise<boolean> {
    if (await this.doClipToElements(viewport, viewport.iModel.selectionSet.elements))
      return true;

    await this.exitTool();
    return false;
  }

  private async doClipToElements(viewport: Viewport, ids: Set<string>): Promise<boolean> {
    try {
      let polyfaces = [];
      for (const source of ids) {
        const meshData = await viewport.iModel.generateElementMeshes({
          ...settings,
          source,
        });

        for (const polyface of readElementMeshes(meshData))
          polyfaces.push(polyface);
      }

      if (polyfaces.length === 0)
        return false;

      const union = UnionOfConvexClipPlaneSets.createEmpty();
      for (const polyface of polyfaces)
        union.addConvexSet(ConvexClipPlaneSet.createConvexPolyface(polyface).clipper);

      ViewClipTool.enableClipVolume(viewport);
      const primitive = ClipPrimitive.createCapture(union);
      const clip = ClipVector.createCapture([primitive]);
      ViewClipTool.setViewClip(viewport, clip);

      this._clipEventHandler?.onNewClip(viewport);

      await this.onReinitialize();
      return true;
    } catch {
      return false;
    }
  }
}
