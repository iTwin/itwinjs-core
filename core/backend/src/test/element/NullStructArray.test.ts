/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import {
  BriefcaseIdValue, Code,  ColorDef,  GeometricElementProps, IModel,
  SubCategoryAppearance,
} from "@itwin/core-common";
import {   _nativeDb, IModelDb, IModelJsFs, SnapshotDb, SpatialCategory } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

interface TestElement extends GeometricElementProps {
  addresses: [null, {city: "Pune", zip: 28}];
}

function initElemProps( _iModelName: IModelDb, modId: Id64String, catId: Id64String, autoHandledProp: any): GeometricElementProps {
  // Create props
  const elementProps: GeometricElementProps = {
    classFullName: "Test:Foo",
    model: modId,
    category: catId,
    code: Code.createEmpty(),
  };
  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);
  return elementProps;
}

describe("Insert Null elements in Struct Array, and ensure they are returned while querying rows", () => {
  const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECStructClass typeName="Location" modifier="Sealed">
    <ECProperty propertyName="City" typeName="string"/>
    <ECProperty propertyName="Zip" typeName="int"/>
  </ECStructClass>
  <ECEntityClass typeName="Foo" modifier="Sealed">
  <BaseClass>bis:PhysicalElement</BaseClass>
    <ECArrayProperty propertyName="I_Array" typeName="int"/>
    <ECArrayProperty propertyName="Dt_Array" typeName="dateTime"/>
    <ECStructArrayProperty propertyName="Addresses" typeName="Location"/>
  </ECEntityClass>
  </ECSchema>`;

  const schemaFileName = "NullStructElementTest.01.00.00.xml";
  const iModelFileName = "NullStructElementTest.bim";
  const categoryName = "NullStructElement";
  const subDirName = "NullStructElement";
  const iModelPath = IModelTestUtils.prepareOutputFile(subDirName, iModelFileName);

  before(async () => {
    // write schema to disk as we do not have api to import xml directly
    const testSchemaPath = IModelTestUtils.prepareOutputFile(subDirName, schemaFileName);
    IModelJsFs.writeFileSync(testSchemaPath, testSchema);

    const imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "InsertNullStructArrayTest" } });
    await imodel.importSchemas([testSchemaPath]);
    imodel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName);
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, categoryName,
        new SubCategoryAppearance({ color: ColorDef.create("rgb(255,0,0)").toJSON() }));

    imodel.saveChanges();
    imodel.close();
  });

  it("Test for struct array to contain null structs", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "roundtrip_correct_data.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // create element with auto handled properties
    const expectedValue = initElemProps( imodel, newModelId, spatialCategoryId!, {
      addresses: [null, {city: "Pune", zip: 28}],
    }) as TestElement;

    // insert a element
    const geomElement = imodel.elements.createElement(expectedValue);
    const id = imodel.elements.insertElement(geomElement.toJSON());
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    imodel.saveChanges();

    // verify inserted element properties
    const actualValue = imodel.elements.getElementProps<TestElement>(id);
    expect(actualValue.addresses.length).to.equal(2);
    expect(actualValue.addresses[0]).to.be.empty;

    imodel.close();
  });

});
