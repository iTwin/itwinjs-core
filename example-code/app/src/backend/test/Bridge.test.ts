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
import { IModelDb, BriefcaseManager, ConcurrencyControl, OpenParams, IModelHost, Subject } from "@bentley/imodeljs-backend";
import { RobotWorld } from "../RobotWorldSchema";
import { insertOrthographicViewDefinition, insertModelSelector, insertCategorySelector, insertDisplayStyle3d, insertSubject, insertDefinitionModel } from "./BridgeUtils";
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

// In this simple example, the source format is assumed to be JSON. It could be anything that the bridge
// can read. In this simple example, the conversion does not involve any alignment transformations. In general,
// the bridge's logic would perform non-trivial alignment of the source data into a BIS industry domain schema.
function convertToBis(briefcase: IModelDb, modelId: Id64, data: RobotWorldProps) {
  for (const barrier of data.barriers) {
    RobotWorldEngine.insertBarrier(briefcase, modelId, Point3d.fromJSON(barrier.location), Angle.fromJSON(barrier.angle), barrier.length);
  }
  for (const robot of data.robots) {
    RobotWorldEngine.insertRobot(briefcase, modelId, robot.name, Point3d.fromJSON(robot.location));
  }
}
// __PUBLISH_EXTRACT_END__

function insertSpatialModel(spatialParentSubject: Subject, modelName: string) {
  return IModelTestUtils.createNewModel(spatialParentSubject, modelName, false);
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

  // I. Import the schema.

  await RobotWorld.importSchema(activityContext, briefcase);
  //    You *must* push this to the iModel right now.
  await briefcase.pullAndMergeChanges(activityContext, accessToken);
  await briefcase.pushChanges(activityContext, accessToken);

  // II. Import data

  // 1. Create the bridge's job subject and definition models.
  //    To keep things organized and to avoid name collisions with other bridges and apps,
  //    a bridge should normally create its own unique subject and then scope its models and
  //    definitions under that.
  const jobSubject = insertSubject(briefcase.elements.getRootSubject(), "RobotWorld"); // Job subject name must be unique among job subjects
  const defModelId = insertDefinitionModel(jobSubject, "definitions");

  // 2. Convert elements, aspects, etc.

  // For this example, we'll put all of the in-coming elements in a single model.
  const spatialModelName = "spatial model 1";
  const spatialModelId = insertSpatialModel(jobSubject, spatialModelName);

  //  Pretend that I connected to a datasource and read it.
  //  In this simple example, the source format is JSON. It could be anything.
  //  Whatever the format, the bridge must be able to read it.
  const sourceData: RobotWorldProps = {
    barriers: [
      { location: { x: 0, y: 5, z: 0 }, angle: { degrees: 0 }, length: 5 },
    ],
    robots: [
      { location: { x: 0, y: 0, z: 0 }, name: "r1" },
    ],
  };
  convertToBis(briefcase, spatialModelId, sourceData);

  // 3. Create views.
  //    Note that the view definition and helper objects go into the definition model, not the spatial model.
  const modelSelectorId = insertModelSelector(briefcase, defModelId, [spatialModelName]);
  const spatialCategoryNames = [RobotWorld.Class.Robot, RobotWorld.Class.Barrier];

  const categorySelectorId = insertCategorySelector(briefcase, defModelId, spatialCategoryNames);
  const displayStyleId = insertDisplayStyle3d(briefcase, defModelId);
  const viewOrigin = { x: 0, y: 0, z: 0 };
  const viewExtents = { x: 10, y: 10, z: 1 }; // Note that you could compute the extents from the imported geometry. But real-world assets have known extents.
  insertOrthographicViewDefinition(briefcase, defModelId, "Test Robot View", modelSelectorId, categorySelectorId, displayStyleId, viewOrigin, viewExtents);

  //  III. Push the data changes to iModel Server

  // 1. Acquire Resources
  //    You *must* do this before pushing
  await briefcase.concurrencyControl.request(activityContext, accessToken);

  // 2. Pull and then push.
  //    Note that you pull and merge first, in case another user has pushed.
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
