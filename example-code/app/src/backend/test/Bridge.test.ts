/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelTestUtils, TestUsers } from "./Utils";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { XYZProps, Angle, AngleProps, Point3d } from "@bentley/geometry-core";
// __PUBLISH_EXTRACT_START__ Bridge.imports.example-code
import { ActivityLoggingContext, Guid, Id64 } from "@bentley/bentleyjs-core";
import { AccessToken, IModelRepository, Project, IModelHubClient, IModelQuery } from "@bentley/imodeljs-clients";
import { IModelDb, BriefcaseManager, ConcurrencyControl, OpenParams, IModelHost } from "@bentley/imodeljs-backend";
import { RobotWorld } from "../RobotWorldSchema";
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Bridge.source-data.example-code
interface BarrierProps {
  location: XYZProps;
  angle: AngleProps;
  length: number;
}

interface RobotProps {
  location: XYZProps;
  name: string;
}

interface RobotWorldProps {
  barriers: BarrierProps[];
  robots: RobotProps[];
}

const data0: RobotWorldProps = {
  barriers: [
    { location: { x: 0, y: 5, z: 0 }, angle: { degrees: 0 }, length: 5 },
  ],
  robots: [
    { location: { x: 0, y: 0, z: 0 }, name: "r1" },
  ],
};

function convertToBis(briefcase: IModelDb, modelId: Id64, data: RobotWorldProps) {
  for (const barrier of data.barriers) {
    RobotWorldEngine.insertBarrier(briefcase, modelId, Point3d.fromJSON(barrier.location), Angle.fromJSON(barrier.angle), barrier.length);
  }
  for (const robot of data.robots) {
    RobotWorldEngine.insertRobot(briefcase, modelId, robot.name, Point3d.fromJSON(robot.location));
  }
}
// __PUBLISH_EXTRACT_END__

function createModel(briefcase: IModelDb) {
  return IModelTestUtils.createNewModel(briefcase.elements.getRootSubject(), "RobotWorld", false);
}

async function queryProjectIdByName(activityContext: ActivityLoggingContext, accessToken: AccessToken, projectName: string): Promise<Project> {
  return await BriefcaseManager.connectClient.getProject(activityContext, accessToken, {
    $select: "*",
    $filter: "Name+eq+'" + projectName + "'",
  });
}

async function queryIModelByName(activityContext: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelName: string): Promise<IModelRepository | undefined> {
  const client = BriefcaseManager.imodelClient as IModelHubClient;
  const iModels = await client.IModels().get(activityContext, accessToken, projectId, new IModelQuery().byName(iModelName));
  if (iModels.length === 0)
    return undefined;
  if (iModels.length > 1)
    return Promise.reject(`Too many iModels with name ${iModelName} found`);
  return iModels[0];
}

async function createIModel(activityContext: ActivityLoggingContext, accessToken: AccessToken, projectId: string, name: string, seedFile: string) {
  try {
    const existingid = await queryIModelByName(activityContext, accessToken, projectId, name);
    if (existingid !== undefined)
      BriefcaseManager.imodelClient.IModels().delete(activityContext, accessToken, projectId, existingid.wsgId);
  } catch (_err) {
  }
  // __PUBLISH_EXTRACT_START__ Bridge.create-imodel.example-code
  const imodelRepository: IModelRepository = await BriefcaseManager.imodelClient.IModels().create(activityContext, accessToken, projectId, name, seedFile);
  // __PUBLISH_EXTRACT_END__
  return imodelRepository;
}

// __PUBLISH_EXTRACT_START__ Bridge.firstTime.example-code
async function runBridgeFirstTime(accessToken: AccessToken, iModelId: string, projectId: string) {
  const activityContext = new ActivityLoggingContext(Guid.createValue());

  const briefcase = await IModelDb.open(activityContext, accessToken, projectId, iModelId, OpenParams.pullAndPush());
  briefcase.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

  // 1. Import schema
  await RobotWorld.importSchema(activityContext, briefcase);
  await briefcase.pullAndMergeChanges(activityContext, accessToken);
  await briefcase.pushChanges(activityContext, accessToken);

  // 2. Import data
  const modelId = createModel(briefcase);
  const sourceData = data0; // pretend that we connected to a datasource and read it.
  convertToBis(briefcase, modelId, sourceData);

  // 3. Acquire Resources and Push ChangeSet to iModel
  await briefcase.concurrencyControl.request(activityContext, accessToken);
  await briefcase.pullAndMergeChanges(activityContext, accessToken);
  await briefcase.pushChanges(activityContext, accessToken);
}
// __PUBLISH_EXTRACT_END__

describe.only("Bridge", async () => {

  let accessToken: AccessToken;
  let testProjectId: string;
  let seedPathname: string;
  let imodelRepository: IModelRepository;

  before(async () => {
    IModelHost.startup();
    const activityContext = new ActivityLoggingContext(Guid.createValue());
    accessToken = await IModelTestUtils.getAccessToken(activityContext, TestUsers.superManager, "QA");
    testProjectId = (await queryProjectIdByName(activityContext, accessToken, "iModelJsTest")).wsgId;
    seedPathname = path.join(KnownTestLocations.assetsDir, "empty.bim");
    imodelRepository = await createIModel(activityContext, accessToken, testProjectId, "BridgeTest", seedPathname);
  });

  it("should run bridge the first time", async () => {
    runBridgeFirstTime(accessToken, imodelRepository.wsgId, testProjectId);
  });
});
