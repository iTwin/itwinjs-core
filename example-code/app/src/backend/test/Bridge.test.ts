/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelTestUtils, TestUsers } from "./Utils";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { XYZProps, Angle, AngleProps, Point3d } from "@bentley/geometry-core";
import { insertOrthographicViewDefinition, insertModelSelector, insertCategorySelector, insertDisplayStyle3d, insertSubject, insertDefinitionModel, insertSpatialCategory } from "./BridgeUtils";
import { Robot } from "../RobotElement";
import { Barrier } from "../BarrierElement";
import { Project, IModelHubClient, IModelQuery } from "@bentley/imodeljs-clients";
// __PUBLISH_EXTRACT_START__ Bridge.imports.example-code
import { ActivityLoggingContext, Guid, Id64 } from "@bentley/bentleyjs-core";
import { AccessToken, HubIModel } from "@bentley/imodeljs-clients";
import { IModelDb, BriefcaseManager, ConcurrencyControl, OpenParams, IModelHost, Subject } from "@bentley/imodeljs-backend";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
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

async function queryIModelByName(activityContext: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
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
  const imodelRepository: HubIModel = await BriefcaseManager.imodelClient.IModels().create(activityContext, accessToken, projectId, name, seedFile);
  // __PUBLISH_EXTRACT_END__
  return imodelRepository;
}

// __PUBLISH_EXTRACT_START__ Bridge.firstTime.example-code
async function runBridgeFirstTime(accessToken: AccessToken, iModelId: string, projectId: string, assetsDir: string) {
  // Start the IModelHost
  IModelHost.startup();
  const activityContext = new ActivityLoggingContext(Guid.createValue());

  const briefcase = await IModelDb.open(activityContext, accessToken, projectId, iModelId, OpenParams.pullAndPush());
  briefcase.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

  // I. Import the schema.
  await briefcase.importSchema(activityContext, path.join(assetsDir, "RobotWorld.ecschema.xml"));
  //    You must acquire all locks reserve all Codes used before saving or pushing.
  await briefcase.concurrencyControl.request(activityContext, accessToken);
  //    You *must* push this to the iModel right now.
  briefcase.saveChanges();
  await briefcase.pullAndMergeChanges(activityContext, accessToken);
  await briefcase.pushChanges(activityContext, accessToken);

  // II. Import data

  // 1. Create the bridge's job subject and definition models.
  //    To keep things organized and to avoid name collisions with other bridges and apps,
  //    a bridge should normally create its own unique subject and then scope its models and
  //    definitions under that.
  const jobSubject = insertSubject(briefcase.elements.getRootSubject(), "RobotWorld"); // Job subject name must be unique among job subjects
  const defModelId = insertDefinitionModel(jobSubject, "definitions");

  //  Create the spatial categories that will be used by the Robots and Barriers that will be imported.
  insertSpatialCategory(briefcase, defModelId, Robot.classFullName, new ColorDef(ColorByName.silver));
  insertSpatialCategory(briefcase, defModelId, Barrier.classFullName, new ColorDef(ColorByName.brown));

  // 2. Convert elements, aspects, etc.

  // For this example, we'll put all of the in-coming elements in a single model.
  const spatialModelId = insertSpatialModel(jobSubject, "spatial model 1");

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
  //    Note how Element IDs are captured as strings.
  const modelSelectorId = insertModelSelector(briefcase, defModelId, [spatialModelId.toString()]);
  const spatialCategoryIds = [Robot.getCategory(briefcase).id.toString(), Barrier.getCategory(briefcase).id.toString()];
  const categorySelectorId = insertCategorySelector(briefcase, defModelId, spatialCategoryIds);
  const displayStyleId = insertDisplayStyle3d(briefcase, defModelId);
  const viewOrigin = { x: 0, y: 0, z: 0 };
  const viewExtents = { x: 10, y: 10, z: 1 }; // Note that you could compute the extents from the imported geometry. But real-world assets have known extents.
  insertOrthographicViewDefinition(briefcase, defModelId, "Test Robot View", modelSelectorId, categorySelectorId, displayStyleId, viewOrigin, viewExtents);

  //  III. Push the data changes to iModel Server

  // 1. Acquire Resources
  //    You must reserve all Codes used before saving or pushing.
  await briefcase.concurrencyControl.request(activityContext, accessToken);

  // 2. Pull and then push.
  //    Note that you pull and merge first, in case another user has pushed.
  briefcase.saveChanges();
  await briefcase.pullAndMergeChanges(activityContext, accessToken);
  await briefcase.pushChanges(activityContext, accessToken);
}
// __PUBLISH_EXTRACT_END__

describe.skip("Bridge", async () => {

  let accessToken: AccessToken;
  let testProjectId: string;
  let seedPathname: string;
  let imodelRepository: HubIModel;

  before(async () => {
    IModelHost.startup();
    const activityContext = new ActivityLoggingContext(Guid.createValue());
    accessToken = await IModelTestUtils.getAccessToken(activityContext, TestUsers.superManager, "QA");
    testProjectId = (await queryProjectIdByName(activityContext, accessToken, "iModelJsTest")).wsgId;
    seedPathname = path.join(KnownTestLocations.assetsDir, "empty.bim");
    imodelRepository = await createIModel(activityContext, accessToken, testProjectId, "BridgeTest", seedPathname);
    IModelHost.shutdown();
  });

  afterEach(() => {
    IModelHost.shutdown();
  });

  it("should run bridge the first time", async () => {
    const assetsDir = path.join(__dirname, "..", "assets");
    runBridgeFirstTime(accessToken, imodelRepository.wsgId, testProjectId, assetsDir);
  });
});
