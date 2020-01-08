/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  IModelReadRpcInterface, IModelTileRpcInterface,
  IModelWriteRpcInterface, SnapshotIModelRpcInterface, WipRpcInterface,
  DevToolsRpcInterface,
} from "@bentley/imodeljs-common";

export const rpcInterfaces = [
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelWriteRpcInterface,
  SnapshotIModelRpcInterface,
  WipRpcInterface,
  DevToolsRpcInterface,
];
