/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, IModelToken, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Id64String, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { AnalysisService } from "./AnalysisService";
import { AnalysisReadRpcInterface } from "../common/AnalysisRpcInterface";

// Implement AnalysisReadRpcInterface
export class AnalysisReadRpcImpl extends RpcInterface implements AnalysisReadRpcInterface {
}

// __PUBLISH_EXTRACT_END__

import { Polyface, Point3d } from "@bentley/geometry-core";
import { AnalysisWriteRpcInterface } from "../common/AnalysisRpcInterface";

// Implement AnalysisWriteRpcInterface
export class AnalysisWriteRpcImpl extends RpcInterface implements AnalysisWriteRpcInterface {
    public async insertMesh(iModelToken: IModelToken, modelId: Id64String, name: string, location: Point3d, polyface: Polyface): Promise<Id64String> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        return AnalysisService.insertMesh(IModelDb.find(iModelToken), modelId, name, location, polyface);
    }
}
// __PUBLISH_EXTRACT_START__ RpcInterface.initializeImplBentleyCloud
import { BentleyCloudRpcManager, BentleyCloudRpcParams } from "@bentley/imodeljs-common";

export function initializeRpcImplBentleyCloud(interfaces: RpcInterfaceDefinition[]) {
    const cloudParams: BentleyCloudRpcParams = { info: { title: "AnalysisImporter", version: "v1.0" } };
    BentleyCloudRpcManager.initializeImpl(cloudParams, interfaces);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeImplDesktop
import { ElectronRpcManager } from "@bentley/imodeljs-common";

export function initializeRpcImplDesktop(interfaces: RpcInterfaceDefinition[]) {
    ElectronRpcManager.initializeImpl({}, interfaces);
}
// __PUBLISH_EXTRACT_END__
