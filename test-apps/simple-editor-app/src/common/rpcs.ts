/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelWriteRpcInterface, Editor3dRpcInterface, NativeAppRpcInterface } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";

/**
 * Returns a list of RPCs supported by this application
 */
export default function getSupportedRpcs(): RpcInterfaceDefinition[] {
  return [
    IModelReadRpcInterface,
    IModelWriteRpcInterface,
    IModelTileRpcInterface,
    PresentationRpcInterface,
    SnapshotIModelRpcInterface,
    Editor3dRpcInterface,
    NativeAppRpcInterface,
  ];
}
