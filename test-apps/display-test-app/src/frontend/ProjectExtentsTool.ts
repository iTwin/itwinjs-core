/* eslint-disable @typescript-eslint/naming-convention */
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import {
  BentleyError,
  BentleyStatus,
  Id64String,
  Logger,
} from "@itwin/core-bentley";
import {
  ClipIntersectionStyle,
  ClipStyle,
  ColorDef,
  RgbColor,
} from "@itwin/core-common";
import {
  BriefcaseConnection,
  HitDetail,
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  ScreenViewport,
  Tool,
  ToolTipProvider,
  ViewClipTool,
} from "@itwin/core-frontend";
import {
  ClipMaskXYZRangePlanes,
  ClipShape,
  ClipVector,
  Range3d,
  Range3dProps,
} from "@itwin/core-geometry";
import { EditTools, makeEditToolIpc } from "@itwin/editor-frontend";
import { toggleProjectExtents } from "@itwin/frontend-devtools";
import { ProjectExtentsClipDecoration } from "./ProjectExtentsDecoration";
import { EditCommandIpc } from "@itwin/editor-common";

const ProjectExtentsEditCommandId = "ProjectExtentsEditCommand";

const InsideColor = RgbColor.fromColorDef(ColorDef.fromString("#33CC33"));
const OutsideColor = RgbColor.fromColorDef(ColorDef.red);
const OverlapColor = RgbColor.fromColorDef(ColorDef.fromString("#0066FF"));

abstract class ProjectExtentsToolBase extends Tool {
  protected static iModelId?: Id64String;

  protected clipFromRange(range: Range3d) {
    const block = ClipShape.createBlock(
      range,
      range.isAlmostZeroZ
        ? ClipMaskXYZRangePlanes.XAndY
        : ClipMaskXYZRangePlanes.All,
      false,
      false
    );
    const clip = ClipVector.createEmpty();
    clip.appendReference(block);
    return clip;
  }

  protected setupDecoration(viewport: ScreenViewport, range: Range3d) {
    // turn off the project extents decoration as we don't want both to show
    toggleProjectExtents(viewport.iModel, false);

    const shown = ProjectExtentsClipDecoration.show(viewport, false);
    if (!shown) return false;

    const clip = this.clipFromRange(range);
    ViewClipTool.enableClipVolume(viewport);
    viewport.view.setViewClip(clip);

    return true;
  }

  protected static getActiveDecoration(viewport: ScreenViewport | undefined) {
    const deco = ProjectExtentsClipDecoration.get();
    return viewport && deco?.viewport === viewport ? deco : undefined;
  }

  protected clearDecoration(viewport: ScreenViewport) {
    this.clearClipStyle(viewport);
    ProjectExtentsClipDecoration.clear();

    // always clip the view to the project extents
    ViewClipTool.enableClipVolume(viewport);
    ViewClipTool.doClipToRange(viewport, viewport.iModel.projectExtents);

    ProjectExtentsToolBase.iModelId = undefined;
  }

  protected clearClipStyle(viewport: ScreenViewport) {
    viewport.clipStyle = ClipStyle.defaults;
  }

  protected setupClipStyle(viewport: ScreenViewport) {
    viewport.clipStyle = ClipStyle.create({
      insideColor: InsideColor,
      outsideColor: OutsideColor,
      intersectionStyle: ClipIntersectionStyle.create(OverlapColor, 10),
      colorizeIntersection: true,
    });
    // seem to need to do this when the camera isn't turned on
    viewport.invalidateRenderPlan();
  }
}

export class ProjectExtentsShowTool extends ProjectExtentsToolBase {
  public static override toolId = "ProjectExtentsShow";
  public static readonly stateChangedSyncEvent = `${ProjectExtentsShowTool.toolId}:stateChanged`;

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp) return false;

    // just return if the decorations are already active
    if (ProjectExtentsToolBase.getActiveDecoration(vp)) return true;

    const iModel = vp.iModel;
    if (!iModel.isBriefcaseConnection()) return false;

    const projectExtents = iModel.projectExtents.clone();
    ProjectExtentsToolBase.iModelId = iModel.iModelId;
    if (!this.setupDecoration(vp, projectExtents)) return false;
    const onChanged = ProjectExtentsClipDecoration.get()?.onChanged;
    onChanged?.clear();
    // onChanged?.addListener((_iModel, event) => {
    //   if (event === ProjectLocationChanged.Extents) {
    //     // SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
    //     //   ProjectExtentsShowTool.stateChangedSyncEvent
    //     // );
    //     // raise the onProjectExtentsChanged event so the GeospatialProvider can update its warnings
    //     iModel.onProjectExtentsChanged.raiseEvent(iModel.projectExtents);
    //   }
    // });

    this.setupClipStyle(vp);

    ProjectExtentsToolTipProvider.setEnabled(true);
    await IModelApp.toolAdmin.startDefaultTool();

    // Start our edit command which will expand the extents of the iModel to include all the models
    // Note: this must be done after the above startDefaultTool call so the edit command doesn't immediately finish when
    // a new PrimitiveTool is started.
    const models = Array.from(iModel.models).map((m) => m.id);
    Logger.logInfo(
      "Frontend debug",
      `Edit tools start command: ${ProjectExtentsEditCommandId}`
    );
    await EditTools.startCommand<string>(
      { commandId: "ProjectExtentsEditCommand", iModelKey: iModel.key },
      models
    );
    Logger.logInfo(
      "Frontend debug",
      `Edit tools start command: ${ProjectExtentsEditCommandId} done`
    );
    return true;
  }

  public static get state() {
    const deco = ProjectExtentsToolBase.getActiveDecoration(
      IModelApp.viewManager.selectedView
    );
    if (!deco) return "Inactive";

    if (deco.getModifiedExtents() !== undefined) return "Modified";

    return "Active";
  }
}

export class ProjectExtentsCancelTool extends ProjectExtentsToolBase {
  public static override toolId = "ProjectExtentsCancel";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) return false;

    if (!ProjectExtentsToolBase.getActiveDecoration(vp)) return false;

    // finish the current command which resets the project extents back
    Logger.logInfo("Frontend debug", `Finish current command`);
    await EditTools.startCommand({ commandId: "", iModelKey: vp.iModel.key });
    Logger.logInfo("Frontend debug", `Finish current command done`);

    this.clearDecoration(vp);
    // SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
    //   ProjectExtentsShowTool.stateChangedSyncEvent
    // );
    ProjectExtentsToolTipProvider.setEnabled(false);
    vp.iModel.onProjectExtentsChanged.raiseEvent(vp.iModel.projectExtents);
    Logger.logInfo("Frontend debug", `startDefaultTool`);
    await IModelApp.toolAdmin.startDefaultTool();
    Logger.logInfo("Frontend debug", `startDefaultTool done`);
    return true;
  }
}

export class ProjectExtentsSaveTool extends ProjectExtentsToolBase {
  public static override toolId = "ProjectExtentsSave";

  private translateMessage(key: string) {
    return `ProjectLocation:Message.${key}`;
  }

  public override async run(): Promise<boolean> {
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    const deco = ProjectExtentsToolBase.getActiveDecoration(
      IModelApp.viewManager.selectedView
    );
    if (undefined === deco || undefined === iModel) {
      IModelApp.notifications.outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Info,
          this.translateMessage("NotActive")
        )
      );
      return false;
    }

    if (iModel.isReadonly) {
      IModelApp.notifications.outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Info,
          this.translateMessage("Readonly")
        )
      );
      return false;
    }

    const newExtents = deco?.getModifiedExtents();
    if (
      ProjectExtentsToolBase.iModelId !== iModel.iModelId ||
      undefined === newExtents
    ) {
      IModelApp.notifications.outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Info,
          this.translateMessage("NoChanges")
        )
      );
      return false;
    }

    if (iModel.isBriefcaseConnection()) {
      const result = await this.updateProjectExtents(iModel, newExtents);
      if (!result) return false;
      const vp = IModelApp.viewManager.selectedView;
      if (vp !== undefined) this.clearDecoration(vp);
    }

    // SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
    //   ProjectExtentsShowTool.stateChangedSyncEvent
    // );
    ProjectExtentsToolTipProvider.setEnabled(false);
    Logger.logInfo("Frontend debug", `startDefaultTool (savetool)`);
    await IModelApp.toolAdmin.startDefaultTool();
    Logger.logInfo("Frontend debug", `startDefaultTool (savetool) done`);
    return true;
  }

  private async updateProjectExtents(
    iModel: BriefcaseConnection,
    range: Range3d
  ) {
    try {
      await projectExtentsIpc.updateProjectExtents(range);
      await iModel.saveChanges("Changed project extents");
    } catch (err) {
      IModelApp.notifications.outputMessage(
        new NotifyMessageDetails(
          OutputMessagePriority.Error,
          BentleyError.getErrorMessage(err) || "An unknown error occurred."
        )
      );
      return false;
    }
    return true;
  }
}

class ProjectExtentsToolTipProvider implements ToolTipProvider {
  private static _instance?: ProjectExtentsToolTipProvider;

  public static setEnabled(enabled: boolean) {
    if (enabled && !ProjectExtentsToolTipProvider._instance) {
      ProjectExtentsToolTipProvider._instance =
        new ProjectExtentsToolTipProvider();
      IModelApp.viewManager.addToolTipProvider(
        ProjectExtentsToolTipProvider._instance
      );
    } else if (!enabled && ProjectExtentsToolTipProvider._instance) {
      IModelApp.viewManager.dropToolTipProvider(
        ProjectExtentsToolTipProvider._instance
      );
      ProjectExtentsToolTipProvider._instance = undefined;
    }
  }

  public async augmentToolTip(
    hit: HitDetail,
    tooltip: Promise<string | HTMLElement>
  ) {
    const result = await tooltip;
    if (!hit.isElementHit) return result;
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) return result;
    const viewClip = vp.view.getViewClip();
    if (!viewClip) return result;

    const containment = await vp.iModel.getGeometryContainment({
      candidates: [hit.sourceId],
      clip: viewClip.toJSON(),
      allowOverlaps: true,
    });

    if (containment.status !== BentleyStatus.SUCCESS) return result;

    // let message = SpatialEditorStudio.translate("tooltip.outsideExtents");
    // if (containment.numInside === 1)
    //   message = SpatialEditorStudio.translate("tooltip.insideExtents");
    // else if (containment.numOverlap === 1)
    //   message = SpatialEditorStudio.translate("tooltip.overlapExtents");
    const message = "message";

    if (typeof result === "string") {
      return `${result}\n${message}`;
    }
    result.innerHTML += `<br>${message}`;
    return result;
  }
}

interface ProjectExtentsEditCommandIpc extends EditCommandIpc {
  updateProjectExtents(extents: Range3dProps): Promise<void>;
}

export const projectExtentsIpc =
  makeEditToolIpc<ProjectExtentsEditCommandIpc>();
