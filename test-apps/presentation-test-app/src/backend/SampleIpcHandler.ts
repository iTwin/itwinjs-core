/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64Arg } from "@itwin/core-bentley";
import { IModelDb, IpcHandler } from "@itwin/core-backend";
import { ElementProps } from "@itwin/core-common";
import { PRESENTATION_TEST_APP_IPC_CHANNEL_NAME, SampleIpcInterface } from "../common/SampleIpcInterface";

/** @internal */
export class SampleIpcHandler extends IpcHandler implements SampleIpcInterface {
  public channelName = PRESENTATION_TEST_APP_IPC_CHANNEL_NAME;

  public async deleteElements(imodelKey: string, elementIds: Id64Arg): Promise<void> {
    const iModelDb = IModelDb.tryFindByKey(imodelKey);
    if (!iModelDb)
      return;

    iModelDb.elements.deleteElement(elementIds);
    iModelDb.saveChanges();
  }

  public async updateElement(imodelKey: string, newProps: ElementProps): Promise<void> {
    const iModelDb = IModelDb.tryFindByKey(imodelKey);
    if (!iModelDb)
      return;

    iModelDb.elements.updateElement(newProps);
    iModelDb.saveChanges();
  }
}
