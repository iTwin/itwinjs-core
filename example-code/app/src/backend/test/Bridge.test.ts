/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";

// __PUBLISH_EXTRACT_START__ Bridge.imports.example-code
import { AccessToken, GuidString, Id64String } from "@itwin/core-bentley";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { Angle, AngleProps, Point3d, Range3d, XYZProps } from "@itwin/core-geometry";
import {
  BriefcaseDb, BriefcaseManager, CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, IModelHost, ModelSelector,
  OrthographicViewDefinition, PhysicalModel, SpatialCategory, Subject,
} from "@itwin/core-backend";
import { ColorByName, IModel, LocalFileName } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { Barrier } from "../BarrierElement";
import { Robot } from "../RobotElement";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { KnownTestLocations } from "./KnownTestLocations";

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
function convertToBis(briefcase: IModelDb, modelId: Id64String, data: RobotWorldProps) {
  for (const barrier of data.barriers) {
    RobotWorldEngine.insertBarrier(briefcase, modelId, Point3d.fromJSON(barrier.location), Angle.fromJSON(barrier.angle), barrier.length);
  }
  for (const robot of data.robots) {
    RobotWorldEngine.insertRobot(briefcase, modelId, robot.name, Point3d.fromJSON(robot.location));
  }
}

// __PUBLISH_EXTRACT_END__

async function getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
  const iTwinList: ITwin[] = await (new ITwinAccessClient()).getAll(accessToken, {
    search: {
      searchString: name,
      propertyName: ITwinSearchableProperty.Name,
      exactMatch: true,
    },
  });

  if (iTwinList.length === 0)
    throw new Error(`ITwin ${name} was not found for the user.`);
  else if (iTwinList.length > 1)
    throw new Error(`Multiple iTwins named ${name} were found for the user.`);

  return iTwinList[0];
}

async function createIModel(accessToken: AccessToken, iTwinId: GuidString, iModelName: string, revision0: LocalFileName) {
  try {
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
    if (iModelId !== undefined)
      await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId, iModelId });
  } catch (_err) {
  }
  // __PUBLISH_EXTRACT_START__ Bridge.create-imodel.example-code
  const newIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iModelName, iTwinId, revision0 });
  // __PUBLISH_EXTRACT_END__
  return newIModelId;
}

// __PUBLISH_EXTRACT_START__ Bridge.firstTime.example-code
async function runBridgeFirstTime(accessToken: AccessToken, iModelId: GuidString, iTwinId: GuidString, assetsDir: string) {
  // Start the IModelHost
  await IModelHost.startup();

  const props = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });
  const briefcase = await BriefcaseDb.open({ fileName: props.fileName });

  // I. Import the schema.
  await briefcase.importSchemas([path.join(assetsDir, "RobotWorld.ecschema.xml")]);
  //    You *must* push this to the iModel right now.
  briefcase.saveChanges();
  await briefcase.pullChanges({ accessToken });
  await briefcase.pushChanges({ accessToken, description: "bridge test" });

  // II. Import data

  // 1. Create the bridge's job subject and definition models.
  //    To keep things organized and to avoid name collisions with other bridges and apps,
  //    a bridge should normally create its own unique subject and then scope its models and
  //    definitions under that.
  const jobSubjectId = Subject.insert(briefcase, IModel.rootSubjectId, "RobotWorld"); // Job subject name must be unique among job subjects
  const defModelId = DefinitionModel.insert(briefcase, jobSubjectId, "definitions");

  //  Create the spatial categories that will be used by the Robots and Barriers that will be imported.
  SpatialCategory.insert(briefcase, defModelId, Robot.classFullName, { color: ColorByName.silver });
  SpatialCategory.insert(briefcase, defModelId, Barrier.classFullName, { color: ColorByName.brown });

  // 2. Convert elements, aspects, etc.

  // For this example, we'll put all of the in-coming elements in a single model.
  const spatialModelId = PhysicalModel.insert(briefcase, jobSubjectId, "spatial model 1");

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
  const viewName = "Test Robot View";
  const modelSelectorId = ModelSelector.insert(briefcase, defModelId, viewName, [spatialModelId]);
  const spatialCategoryIds = [Robot.getCategory(briefcase).id, Barrier.getCategory(briefcase).id];
  const categorySelectorId = CategorySelector.insert(briefcase, defModelId, viewName, spatialCategoryIds);
  const displayStyleId = DisplayStyle3d.insert(briefcase, defModelId, viewName);
  const viewRange = new Range3d(0, 0, 0, 10, 10, 1); // Note that you could compute the extents from the imported geometry. But real-world assets have known extents.
  OrthographicViewDefinition.insert(briefcase, defModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, viewRange);

  //  III. Push the data changes to iModel Server
  //    Note that you pull and merge first, in case another user has pushed.
  //    Also note that after pushing, all locks will be released.
  briefcase.saveChanges();
  await briefcase.pullChanges({ accessToken });
  await briefcase.pushChanges({ accessToken, description: "bridge test" });
}
// __PUBLISH_EXTRACT_END__

describe.skip("Bridge", async () => {

  let accessToken: AccessToken;
  let testITwinId: GuidString;
  let revision0: LocalFileName;
  let iModelId: GuidString;

  before(async () => {
    await IModelHost.startup();
    accessToken = await TestUtility.getAccessToken(TestUsers.superManager);
    testITwinId = (await getITwinByName(accessToken, "iModelJsIntegrationTest")).id;
    revision0 = path.join(KnownTestLocations.assetsDir, "empty.bim");
    iModelId = await createIModel(accessToken, testITwinId, "BridgeTest", revision0);
    await IModelHost.shutdown();
  });

  afterEach(async () => {
    await IModelHost.shutdown();
  });

  it("should run bridge the first time", async () => {
    const assetsDir = path.join(__dirname, "..", "assets");
    await runBridgeFirstTime(accessToken, iModelId, testITwinId, assetsDir);
  });
});
