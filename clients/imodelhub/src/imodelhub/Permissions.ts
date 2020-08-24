/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { Permission, RbacClient } from "@bentley/rbac-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelQuery, IModelsHandler } from "./iModels";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/** iModelHub Permission
 * @internal
 */
export enum IModelHubPermission {
  None = 0,
  Create = 1 << 0,
  Read = 1 << 1,
  Modify = 1 << 2,
  Delete = 1 << 3,
  ManageResources = 1 << 4,
  ManageVersions = 1 << 5,
  View = 1 << 6,
  ConfigureIModelAccess = 1 << 7,
}

/**
 * Handler for managing permissions. Use [[IModelHubClient.permissions]] to get an instance of this class.
 * @internal
 */
export class PermissionHandler {
  private _imodelsHandler: IModelsHandler;
  private _rbacClient: RbacClient;
  private static _objectTypeId?: string;
  private static readonly _objectTypeName: string = "IMHS_ObjectType_iModel";
  private static readonly _serviceGPRId = 2485;

  /**
   * Constructor for PermissionHandler.
   * @param imodelsHandler The handler for [[HubIModel]]s.
   * @internal
   */
  constructor(imodelsHandler: IModelsHandler, rbacClient: RbacClient) {
    this._imodelsHandler = imodelsHandler;
    this._rbacClient = rbacClient;
  }

  /**
   * Get user permissions of a specified CONNECT context. Use it only to check CONNECT context level permissions (Create iModel, Delete iModel, Configure iModel access). Use [[PermissionHandler.getiModelPermissions]] to check iModel level permissions.
   * @param requestContext The client request context.
   * @param contextId Id of the specified CONNECT context.
   */
  public async getContextPermissions(requestContext: AuthorizedClientRequestContext, contextId: GuidString): Promise<IModelHubPermission> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying permissions for Context", () => ({ contextId }));

    const permissionInstances: Permission[] = await this._rbacClient.getPermissions(requestContext, contextId, PermissionHandler._serviceGPRId);
    requestContext.enter();
    return PermissionHandler.parseIModelHubPermissions(permissionInstances);
  }

  /**
   * Get user permissions of an specified iModel. Use it only to check iModel level permissions (View, Read, Modify, Modify resources, Modify versions). Use [[PermissionHandler.getContextPermissions]] to check CONNECT context level permissions.
   * @param requestContext The client request context.
   * @param contextId Id of the specified CONNECT context.
   * @param iModelId Id of the specified iModel.
   */
  public async getiModelPermissions(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString): Promise<IModelHubPermission> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying permissions for iModel", () => ({ iModelId }));

    const contextPermissions = await this.getContextPermissions(requestContext, contextId);
    requestContext.enter();
    if (contextPermissions === IModelHubPermission.None)
      return contextPermissions;

    const imodels = await this._imodelsHandler.get(requestContext, contextId, new IModelQuery().byId(iModelId));
    requestContext.enter();

    const imodel = imodels[0];
    if (!imodel.secured)
      return contextPermissions;

    if (!PermissionHandler._objectTypeId) {
      PermissionHandler._objectTypeId = await this._rbacClient.getObjectTypeId(requestContext, PermissionHandler._objectTypeName, PermissionHandler._serviceGPRId);
      requestContext.enter();
    }

    const imodelPermissions = await this._rbacClient.getObjectPermissions(requestContext, iModelId, PermissionHandler._objectTypeId);
    requestContext.enter();

    return PermissionHandler.parseIModelHubPermissions(imodelPermissions);
  }

  /**
   * Parse iModelHub permissions.
   * @param permissionInstances Permissions instances.
   */
  private static parseIModelHubPermissions(permissionInstances: Permission[]): IModelHubPermission {
    let permissions: IModelHubPermission = IModelHubPermission.None;
    for (const permissionInstance of permissionInstances) {
      switch (permissionInstance.wsgId) {
        case "IMHS_Create_iModel":
          permissions = permissions | IModelHubPermission.Create | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Read_iModel":
          permissions = permissions | IModelHubPermission.Read | IModelHubPermission.View;
          break;
        case "IMHS_Modify_iModel":
          permissions = permissions | IModelHubPermission.Modify | IModelHubPermission.View | IModelHubPermission.Read;
          break;
        case "IMHS_Delete_iModel":
          permissions = permissions | IModelHubPermission.Delete | IModelHubPermission.View | IModelHubPermission.Read;
          break;
        case "IMHS_ManageResources":
          permissions = permissions | IModelHubPermission.ManageResources | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Manage_Versions":
          permissions = permissions | IModelHubPermission.ManageVersions | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Web_View":
          permissions = permissions | IModelHubPermission.View;
          break;
        case "IMHS_iModel_Perm":
          permissions = permissions | IModelHubPermission.ConfigureIModelAccess;
          break;
        default:
      }
    }

    return permissions;
  }
}
