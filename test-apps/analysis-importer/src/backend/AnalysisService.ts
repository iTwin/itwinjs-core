/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, RpcManager, IModelReadRpcInterface, IModelWriteRpcInterface, GeometricElement3dProps, Code } from "@bentley/imodeljs-common";
import { IModelDb, IModelHost, IModelHostConfiguration, KnownLocations, Platform } from "@bentley/imodeljs-backend";
import { Id64Props, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { } from "@bentley/imodeljs-common";
import { Polyface, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { AnalysisSchema, Analysis } from "./AnalysisSchema";
import { AnalysisMeshElement } from "./AnalysisElement";
import * as path from "path";
import { TestRpcManager } from "@bentley/imodeljs-common/lib/rpc/TestRpcManager";
import { AnalysisWriteRpcInterface, AnalysisReadRpcInterface } from "../common/AnalysisRpcInterface";
import { AnalysisWriteRpcImpl, AnalysisReadRpcImpl } from "./AnalysisRpcImpl";

// An example of how to implement a service.
export class AnalysisService {

    // __PUBLISH_EXTRACT_START__ Element.createGeometricElement3d.example-code
    public static insertMesh(iModelDb: IModelDb, modelId: Id64Props, name: string, location: Point3d, polyface: Polyface): Id64Props {
        const props: GeometricElement3dProps = {
            model: modelId,
            code: Code.createEmpty(),
            classFullName: Analysis.Class.Mesh,
            category: AnalysisMeshElement.getCategory(iModelDb).id,
            geom: AnalysisMeshElement.generateGeometry(polyface),
            placement: { origin: location, angles: new YawPitchRollAngles() },
            userLabel: name,
        };
        return iModelDb.elements.insertElement(props);
    }
    // __PUBLISH_EXTRACT_END__

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

        // __PUBLISH_EXTRACT_START__ Schema.registerSchema
        // Register the TypeScript schema classes that I intend to use.
        AnalysisSchema.registerSchema();
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ Schema.importSchemopea
        // Make sure the schema is in the iModel.
        IModelDb.onOpened.addListener((iModel: IModelDb) => {
            AnalysisSchema.importSchema(activityContext, iModel);
        });
        // __PUBLISH_EXTRACT_END__
    }

    private static registerImpls() {
        // __PUBLISH_EXTRACT_START__ RpcInterface.registerImpls
        RpcManager.registerImpl(AnalysisReadRpcInterface, AnalysisReadRpcImpl);
        // __PUBLISH_EXTRACT_END__
    }

    // __PUBLISH_EXTRACT_START__ RpcInterface.selectInterfacesToExpose
    private static chooseInterfacesToExpose(): RpcInterfaceDefinition[] {
        const interfaces: RpcInterfaceDefinition[] = [IModelReadRpcInterface, IModelWriteRpcInterface, AnalysisReadRpcInterface, AnalysisWriteRpcInterface];

        return interfaces;
    }
    // __PUBLISH_EXTRACT_END__

    public static shutdown() {
        IModelHost.shutdown();
    }

}
