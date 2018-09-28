/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, RpcManager, IModelReadRpcInterface, IModelWriteRpcInterface, GeometricElement3dProps, Code } from "@bentley/imodeljs-common";
import { IModelDb, IModelHost, IModelHostConfiguration, KnownLocations, Platform } from "@bentley/imodeljs-backend";
import { Id64String, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { } from "@bentley/imodeljs-common";
import { Polyface, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { AnalysisSchema, Analysis } from "./AnalysisSchema";
import { AnalysisMeshElement } from "./AnalysisElement";
import * as path from "path";
import { TestRpcManager } from "@bentley/imodeljs-common/lib/rpc/TestRpcManager";
import { AnalysisWriteRpcInterface, AnalysisReadRpcInterface } from "../common/AnalysisRpcInterface";
import { AnalysisWriteRpcImpl, AnalysisReadRpcImpl } from "./AnalysisRpcImpl";

export class AnalysisService {

    public static insertMesh(iModelDb: IModelDb, modelId: Id64String, name: string, location: Point3d, polyface: Polyface): Id64String {
        const categoryId = AnalysisMeshElement.getCategory(iModelDb).id;
        const props: GeometricElement3dProps = {
            model: modelId,
            code: Code.createEmpty(),
            classFullName: Analysis.Class.Mesh,
            category: categoryId,
            geom: AnalysisMeshElement.generateGeometry(polyface, categoryId),
            placement: { origin: location, angles: new YawPitchRollAngles() },
            userLabel: name,
        };
        return iModelDb.elements.insertElement(props);
    }

    public static initialize(activityContext: ActivityLoggingContext) {
        const config = new IModelHostConfiguration();
        if (Platform.isNodeJs)
            config.appAssetsDir = path.join(__dirname, "assets");
        else
            config.appAssetsDir = KnownLocations.packageAssetsDir;

        IModelHost.startup(config);

        RpcManager.registerImpl(AnalysisWriteRpcInterface, AnalysisWriteRpcImpl); // register impls that we don't want in the doc example
        this.registerImpls();
        const interfaces = this.chooseInterfacesToExpose();

        TestRpcManager.initialize(interfaces);
        AnalysisSchema.registerSchema();
        IModelDb.onOpened.addListener((iModel: IModelDb) => {
            AnalysisSchema.importSchema(activityContext, iModel);
        });
    }

    private static registerImpls() {
        RpcManager.registerImpl(AnalysisReadRpcInterface, AnalysisReadRpcImpl);
    }

    private static chooseInterfacesToExpose(): RpcInterfaceDefinition[] {
        const interfaces: RpcInterfaceDefinition[] = [IModelReadRpcInterface, IModelWriteRpcInterface, AnalysisReadRpcInterface, AnalysisWriteRpcInterface];

        return interfaces;
    }

    public static shutdown() {
        IModelHost.shutdown();
    }

}
