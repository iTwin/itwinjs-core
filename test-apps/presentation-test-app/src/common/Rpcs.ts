/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelTileRpcInterface, IModelReadRpcInterface, StandaloneIModelRpcInterface } from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Presentation.Common.Imports
import { PresentationRpcInterface } from "@bentley/presentation-common";
// __PUBLISH_EXTRACT_END__
import SampleRpcInterface from "./SampleRpcInterface";

const otherRpcInterfaces = [IModelTileRpcInterface, IModelReadRpcInterface, StandaloneIModelRpcInterface, SampleRpcInterface];
// __PUBLISH_EXTRACT_START__ Presentation.Common.RpcInterface
const rpcs = [...otherRpcInterfaces, PresentationRpcInterface];
// __PUBLISH_EXTRACT_END__

export default rpcs;
