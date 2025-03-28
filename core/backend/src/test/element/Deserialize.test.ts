import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "node:path";
import * as sinon from "sinon";

describe("Element Deserialize", () => {
  let iModelDb: SnapshotDb;

  before(async () => {
    // Get a Test iModel
    IModelTestUtils.registerTestBimSchema();
    iModelDb = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await iModelDb.importSchemas([schemaPathname]);
  });

  after(() => {
    iModelDb.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should correctly set globalOrigin for GeometricModel2d", async () => {

  });

});
