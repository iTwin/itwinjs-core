/* eslint-disable @typescript-eslint/naming-convention */
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { BasicManipulationCommand, EditCommand } from "@itwin/editor-backend";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { IModelDb } from "@itwin/core-backend";
import { Logger } from "@itwin/core-bentley";
import { EditCommandIpc } from "@itwin/editor-common";

interface ProjectExtentsEditCommandIpc extends EditCommandIpc {
  updateProjectExtents(extents: Range3dProps): Promise<void>;
}
const ProjectExtentsEditCommandId = "ProjectExtentsEditCommand";

export class ProjectExtentsEditCommand
  extends EditCommand
  implements ProjectExtentsEditCommandIpc
{
  public static override commandId = ProjectExtentsEditCommandId;
  private _originalExtents?: Range3d;
  private _updated = false;
  private _models: string[];

  public constructor(iModel: IModelDb, _models: string[]) {
    super(iModel);
    this._models = _models;
  }

  public override async onStart() {
    Logger.logTrace("extentsCommand", "onstart");
    this._originalExtents = this.iModel.projectExtents.clone();
    Logger.logTrace("extentsCommand", "cloned orig extents");
    const range = await this.iModel.models.queryRange(this._models);
    Logger.logTrace("extentsCommand", "got range");
    this.iModel.updateProjectExtents(range);
    Logger.logTrace("extentsCommand", "updates project extents");
    return ProjectExtentsEditCommand.commandId;
  }

  public async updateProjectExtents(extents: Range3dProps): Promise<void> {
    try {
      // Normally BasicManipulationCommand is constructed through IPC calls but deferring to its updateProjectExtents implementation.
      // The 2nd parameter is unused.
      Logger.logTrace("extentsCommand", "update project extents cmd");
      const basicManipulationCmd = new BasicManipulationCommand(
        this.iModel,
        "unused"
      );
      Logger.logTrace("extentsCommand", "got command");
      await basicManipulationCmd.updateProjectExtents(extents);
      Logger.logTrace("extentsCommand", "updated extents");
      this._updated = true;
    } catch (error) {
      Logger.logError("extentsCommand", (error as any).message);
      // Booster looks for specific error codes, not sure if that's really needed:
      // https://dev.azure.com/bentleycs/Civil-iTwin/_git/Booster?path=/apps/booster/src/frontend/helpers/IModelOperations.tsx&version=GBmain&line=103&lineEnd=114&lineStartColumn=1&lineEndColumn=116&lineStyle=plain&_a=contents
      try {
        // don't retain a schema lock if we fail to update the extents
        if (this.iModel.holdsSchemaLock) {
          Logger.logError("extentsCommand", "[in error] imodel has locks");
          await this.iModel.locks.releaseAllLocks();
          Logger.logError("extentsCommand", "[in error] released all locks");
        }
      } catch (innerError) {
        Logger.logError(
          "extentsCommand",
          "[in error] inner error occurred while releasing locks"
        );
        Logger.logError("extentsCommand", (innerError as any).message);
      }
      throw error;
    }
  }

  public override async requestFinish(): Promise<string> {
    Logger.logTrace("extentsCommand", "requesting finish!");
    if (!this._updated && this._originalExtents) {
      Logger.logTrace(
        "extentsCommand",
        "update extents before request finish!"
      );
      try {
        this.iModel.updateProjectExtents(this._originalExtents);
      } catch (error) {
        Logger.logTrace(
          "extentsCommand",
          "update extents before request finish ERRORRR"
        );
        Logger.logError("extentsCommand", (error as any).message);
      }

      Logger.logTrace(
        "extentsCommand",
        "update extents before request finish - DONE"
      );
    }
    Logger.logTrace("extentsCommand", "returning done!");
    return "done";
  }
}
