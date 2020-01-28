/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IModelError } from "@bentley/imodeljs-common";

export class AppState {
  private static _iModelConnection: IModelConnection | undefined = undefined;
  public static readonly onIModelOpened = new BeEvent();
  public static readonly onIModelClose = new BeEvent();

  public static startup() {
  }

  public static async onOpen(iModel: IModelConnection) {
    this._iModelConnection = iModel;
    this.onIModelOpened.raiseEvent();
  }

  public static async onClose() {
    this.onIModelClose.raiseEvent();
    this._iModelConnection = undefined;
  }

  public static get isOpen(): boolean {
    return this._iModelConnection !== undefined;
  }
  public static get iModelConnection(): IModelConnection {
    if (this._iModelConnection === undefined)
      throw new IModelError(IModelStatus.NotOpen, "");
    return this._iModelConnection;
  }
}
