/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelTileRpcInterface, IModelReadRpcInterface, StandaloneIModelRpcInterface } from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Common.Imports
import { PresentationRpcInterface } from "@bentley/presentation-common";
// __PUBLISH_EXTRACT_END__
import SampleRpcInterface from "./SampleRpcInterface";

const otherRpcInterfaces = [IModelTileRpcInterface, IModelReadRpcInterface, StandaloneIModelRpcInterface, SampleRpcInterface];
// __PUBLISH_EXTRACT_START__ Common.Initialization.RpcInterface
const rpcs = [...otherRpcInterfaces, PresentationRpcInterface];
// __PUBLISH_EXTRACT_END__

export default rpcs;
