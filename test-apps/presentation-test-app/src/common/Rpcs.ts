/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Presentation.Common.RpcInterface.Imports
import { PresentationRpcInterface } from "@bentley/presentation-common";
// __PUBLISH_EXTRACT_END__
import SampleRpcInterface from "./SampleRpcInterface";

const otherRpcInterfaces = [IModelTileRpcInterface, IModelReadRpcInterface, SnapshotIModelRpcInterface, SampleRpcInterface];
// __PUBLISH_EXTRACT_START__ Presentation.Common.RpcInterface
const rpcInterfaces = [...otherRpcInterfaces, PresentationRpcInterface];
// __PUBLISH_EXTRACT_END__

export default rpcInterfaces;
