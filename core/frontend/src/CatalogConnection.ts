/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { CatalogIModelTypes, IModelError } from "@itwin/core-common";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { IModelStatus, OpenMode } from "@itwin/core-bentley";
import { NativeApp } from "./NativeApp";

/** @beta */
export class CatalogConnection extends BriefcaseConnection {

  protected override requireTimeline(): void {
    throw new IModelError(IModelStatus.WrongIModel, "Catalogs have no timeline");
  }

  public static async createNewContainer(args: CatalogIModelTypes.CreateNewContainerArgs): Promise<CatalogIModelTypes.NewContainerProps> {
    return NativeApp.catalogIpc.createNewContainer(args);
  }

  public static async acquireWriteLock(args: { containerId: string, username: string; }): Promise<void> {
    return NativeApp.catalogIpc.acquireWriteLock(args);
  }

  public static async releaseWriteLock(args: { containerId: string, abandon?: true; }): Promise<void> {
    return NativeApp.catalogIpc.releaseWriteLock(args);
  }

  public static async createNewVersion(args: CatalogIModelTypes.CreateNewVersionArgs): Promise<{ oldDb: CatalogIModelTypes.NameAndVersion; newDb: CatalogIModelTypes.NameAndVersion; }> {
    return NativeApp.catalogIpc.createNewVersion(args);
  }

  public static async openReadonly(args: CatalogIModelTypes.OpenReadonlyArgs): Promise<CatalogConnection> {
    const openResponse = await NativeApp.catalogIpc.openReadonly(args);
    const connection = new CatalogConnection(openResponse, OpenMode.Readonly);
    this.onOpen.raiseEvent(connection);
    return connection;
  }

  public static async openEditable(args: CatalogIModelTypes.OpenEditableArgs): Promise<CatalogConnection> {
    const openResponse = await NativeApp.catalogIpc.openEditable(args);
    const connection = new CatalogConnection(openResponse, OpenMode.ReadWrite);
    this.onOpen.raiseEvent(connection);
    return connection;
  }
}