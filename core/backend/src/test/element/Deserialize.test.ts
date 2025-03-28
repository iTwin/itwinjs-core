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

  it("should properly read an Element and deserialize it", async () => {
    // get an element

    // deserialize the element

    // verify the element was deserialized correctly
  });

});
