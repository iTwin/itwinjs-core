/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, Id64String } from "@itwin/core-bentley";
import { BriefcaseDb } from "../IModelDb";
import { HubWrappers, IModelTestUtils } from "./IModelTestUtils";
import { ChannelControl } from "../ChannelControl";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { DrawingCategory } from "../Category";
import { HubMock } from "../internal/HubMock";
import { KnownTestLocations } from "./KnownTestLocations";
import * as chai from "chai";
import { TestUtils } from "./TestUtils";

const schemas = {
  /** Base schema v01.00.00 with classes A, C, D */
  v01x00x00: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.01 - Adds PropC2 to class C (trivial additive change) */
  v01x00x01AddPropC2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.02 - Adds PropD2 to class D (trivial additive change) */
  v01x00x02AddPropD2: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.02 - Moves PropC from C to A (requires data transformation) on top of v01.00.01 */
  v01x00x02MovePropCToA: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.03 - Builds on top of v01.00.02 and in addition moves PropD to base, so we can have incoming and local transforming changes */
  v01x00x03MovePropCAndD: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.03" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC2" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD2" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.01 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (same version) */
  v01x00x01AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.02 (incompatible variant) - Adds PropC3 instead of PropC2 to class C (higher version) */
  v01x00x02AddPropC3Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC3" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,

  /** v01.00.02 (incompatible variant) - Adds PropC2 (higher version, different type) */
  v01x00x02AddPropC2Incompatible: `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="td" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
      <ECEntityClass typeName="A">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="PropA" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="C">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropC" typeName="string"/>
        <ECProperty propertyName="PropC2" typeName="int"/>
      </ECEntityClass>
      <ECEntityClass typeName="D">
        <BaseClass>A</BaseClass>
        <ECProperty propertyName="PropD" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
};

describe("SquashSchemaAndDataChanges", () => {
  let imodel: BriefcaseDb;
  let iModelId: string;
  let drawingModelId: string;
  let drawingCategoryId: string;

  const createModelAndCategory = async (db: BriefcaseDb) => {
    const modelCode = IModelTestUtils.getUniqueModelCode(db, "DrawingModel");
    await db.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, newDrawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(db, modelCode);
    const newDrawingCategoryId = DrawingCategory.insert(
      db,
      IModel.dictionaryId,
      "DrawingCategory",
      new SubCategoryAppearance()
    );
    db.saveChanges();
    return [newDrawingModelId, newDrawingCategoryId];
  };

  const insertElement = (
    briefcase: BriefcaseDb,
    className: string,
    properties: Record<string, any>
  ): Id64String => {
    const elementProps: GeometricElementProps = {
      classFullName: className,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      ...properties,
    };
    const element = briefcase.elements.createElement(elementProps);
    return briefcase.elements.insertElement(element.toJSON());
  }

  before(async () => {
    HubMock.startup("MergeSchemaAndDataChanges", KnownTestLocations.outputDir);
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ useSemanticRebase: true });
  });

  beforeEach(async () => {
    iModelId = await HubWrappers.createIModel("user1", HubMock.iTwinId, `Test-${Guid.createValue()}`);

    imodel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });

    imodel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    imodel.saveChanges();
    [drawingModelId, drawingCategoryId] = await createModelAndCategory(imodel);
    await imodel.importSchemaStrings([schemas.v01x00x00, schemas.v01x00x01AddPropC2]);
    await imodel.pushChanges({ description: "create model and category and imported schemas" });
  });

  afterEach(async () => {
    imodel.close();
    await HubMock.deleteIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
  });

  after(async () => {
    HubMock.shutdown();
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  });

  it("should throw error if tried to import schema while unsaved changes are present", async () => {
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    insertElement(imodel, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });

    await chai.expect(imodel.importSchemaStrings([schemas.v01x00x02MovePropCToA])).to.be.rejectedWith("Cannot import schemas with unsaved changes when useSemanticRebase flag is on");
    await imodel.discardChanges();
  });

  it("should squash schema and data changes if useSemanticRebase flag is on", async () => {
    await imodel.locks.acquireLocks({ shared: drawingModelId });
    insertElement(imodel, "TestDomain:C", {
      propA: "local_value_a",
      propC: "local_value_c",
    });
    imodel.saveChanges("local data change");
    await imodel.importSchemaStrings([schemas.v01x00x02MovePropCToA]); // transforming data change

    const lastTxnProps = imodel.txns.getLastSavedTxnProps();
    chai.assert(lastTxnProps !== undefined);
    chai.assert(lastTxnProps?.type === "Schema");
    chai.assert(lastTxnProps?.prevId !== undefined);
    // both schema and data(migration) changes are merged into single txn

    const secondLastTxnProps = imodel.txns.getTxnProps(lastTxnProps.prevId);
    chai.assert(secondLastTxnProps !== undefined);
    chai.assert(secondLastTxnProps?.type === "Ddl");
    chai.assert(secondLastTxnProps?.prevId !== undefined);

    const thirdLastTxnProps = imodel.txns.getTxnProps(secondLastTxnProps.prevId);
    chai.assert(thirdLastTxnProps !== undefined);
    chai.assert(thirdLastTxnProps?.type === "Data");
    chai.assert(thirdLastTxnProps?.prevId === undefined);

    await imodel.discardChanges();
  });
});