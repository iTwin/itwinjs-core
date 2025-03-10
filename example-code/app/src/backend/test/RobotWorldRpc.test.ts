/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64, Id64String, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { Angle, Point3d } from "@itwin/core-geometry";
import { IModelJsFs, PhysicalModel, StandaloneDb } from "@itwin/core-backend";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams, EmptyLocalization, GeometricElement3dProps, IModel, IModelReadRpcInterface,
  RpcInterfaceDefinition, SnapshotIModelRpcInterface, TestRpcManager,
} from "@itwin/core-common";
import { BriefcaseConnection, NullRenderSystem } from "@itwin/core-frontend";
import { RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface } from "../../common/RobotWorldRpcInterface";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { RobotWorld } from "../RobotWorldSchema";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelTestUtils } from "./Utils";

async function simulateBackendDeployment(): Promise<void> {
  await RobotWorldEngine.initialize();
}

async function simulateBackendShutdown() {
  await RobotWorldEngine.shutdown();
}

async function setUpTest() {
  // Make a copy for the tests to work on
  const iModelFile = IModelTestUtils.prepareOutputFile("RobotWorldRpc.bim");
  const seedFile = IModelTestUtils.resolveAssetFile("empty.bim");
  IModelJsFs.copySync(seedFile, iModelFile);
  const iModel = StandaloneDb.openFile(iModelFile, OpenMode.ReadWrite);
  await RobotWorld.importSchema(iModel);
  iModel.saveChanges();
  PhysicalModel.insert(iModel, IModel.rootSubjectId, "test");
  iModel.saveChanges();
  iModel.close();
}

if (ProcessDetector.isElectronAppFrontend) {
  describe("RobotWorldRpc", () => {

    it("should run robotWorld through Ipc as a client", async () => {
      // Simulate the deployment of the backend server
      await simulateBackendDeployment();

      await setUpTest();  // tricky: do this after simulateBackendDeployment, as that function has the side effect of initializing IModelHost

      await ElectronApp.startup({
        iModelApp: {
          renderSys: new NullRenderSystem(),
          localization: new EmptyLocalization(),
        },
      });

      // expose interfaces using a direct call mechanism
      TestRpcManager.initialize([SnapshotIModelRpcInterface, IModelReadRpcInterface, RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface]); // eslint-disable-line @typescript-eslint/no-deprecated
      const roWrite = RobotWorldWriteRpcInterface.getClient();
      const roRead = RobotWorldReadRpcInterface.getClient();

      const iModel = await BriefcaseConnection.openFile({ fileName: `${KnownTestLocations.outputDir}/` + `RobotWorldRpc.bim` });
      assert.isTrue(iModel !== undefined);
      const iToken = iModel.getRpcProps();

      let modelId!: Id64String;
      for (const modelStr of await iModel.queryEntityIds({ from: "bis:element", where: "CodeValue='test'" }))
        modelId = Id64.fromString(modelStr);

      //  Initial placement: Robot1 is not touching any barrier (or other robot)
      //
      //  |
      //  |<---barrier1------->
      //  |                   ^
      //  |                   |
      //  |                   barrier2
      //  |                   |
      //  |R1                 V
      //  +-- -- -- -- -- -- --
      const robot1Id = await roWrite.insertRobot(iToken, modelId, "r1", Point3d.create(0, 0, 0).toJSON());
      const barrier1Id = await roWrite.insertBarrier(iToken, modelId, Point3d.create(0, 5, 0).toJSON(), Angle.createDegrees(0).toJSON(), 5);
      const barrier2Id = await roWrite.insertBarrier(iToken, modelId, Point3d.create(5, 0, 0).toJSON(), Angle.createDegrees(90).toJSON(), 5);

      await iModel.saveChanges();
      const barrier1 = (await iModel.elements.getProps(barrier1Id))[0] as GeometricElement3dProps;
      /* const barrier2 = */
      await iModel.elements.getProps(barrier2Id);
      assert.equal(await roRead.countRobots(iToken), 1);

      const hits0 = await roRead.queryObstaclesHitByRobot(iToken, robot1Id);
      assert.equal(hits0.length, 0, "no collisions initially");

      //  Move Robot1 up, so that it touches barrier1 but not barrier2
      //
      //  |
      //  |<---barrier1------->
      //  |R1                 ^
      //  |                   |
      //  |                   barrier2
      //  |                   |
      //  |                   V
      //  +-- -- -- -- -- -- --
      if (true) {
        await roWrite.moveRobot(iToken, robot1Id, barrier1.placement!.origin);
        await iModel.saveChanges();
        const r1 = (await iModel.elements.getProps(robot1Id))[0] as GeometricElement3dProps;
        assert.deepEqual(r1.placement!.origin, barrier1.placement!.origin);
        const barriersHit = await roRead.queryObstaclesHitByRobot(iToken, robot1Id);
        assert.equal(barriersHit.length, 1, "expect a collision");
        assert.equal(barriersHit[0].toString(), barrier1.id);
      }

      await iModel.close();

      await ElectronApp.shutdown();

      await simulateBackendShutdown();
    });
  });
}

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeClientBentleyCloudApp

export function initializeRpcClientBentleyCloudForApp(interfaces: RpcInterfaceDefinition[]) {
  const cloudParams: BentleyCloudRpcParams = { info: { title: "RobotWorldEngine", version: "v1.0" } };
  BentleyCloudRpcManager.initializeClient(cloudParams, interfaces);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeClientBentleyCloudRemote
export function initializeRpcClientBentleyCloud(interfaces: RpcInterfaceDefinition[], serviceUrl?: string) {
  const cloudParams: BentleyCloudRpcParams = { info: { title: "RobotWorldEngine", version: "v1.0" }, uriPrefix: serviceUrl };
  BentleyCloudRpcManager.initializeClient(cloudParams, interfaces);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeFrontendForElectron

export async function initializeElectron(rpcInterfaces: RpcInterfaceDefinition[]) {
  await ElectronApp.startup({
    iModelApp: {
      rpcInterfaces,
      localization: new EmptyLocalization(),
    },
  });
}
// __PUBLISH_EXTRACT_END__
