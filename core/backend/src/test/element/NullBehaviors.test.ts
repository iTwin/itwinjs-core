/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { IModelDb, IModelJsFs, SnapshotDb, SpatialCategory } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

interface TestSchemaLocation {
  city: string;
  zip: number;
}

interface TestElement extends GeometricElementProps {
  addresses: TestSchemaLocation[];
  favoriteNumbers: number[];
}

function initElemProps( _iModelName: IModelDb, modId: Id64String, catId: Id64String, autoHandledProp: any): GeometricElementProps {
  // Create props
  const elementProps: GeometricElementProps = {
    classFullName: "Test:TestClass",
    model: modId,
    category: catId,
    code: Code.createEmpty(),
  };
  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);
  return elementProps;
}

describe("Various ECProperties null behavior handling cases test fixture", () => {
  const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestSchema" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
    <ECStructClass typeName="Location" modifier="None">
      <ECProperty propertyName="City" typeName="string"/>
      <ECProperty propertyName="Zip" typeName="int"/>
    </ECStructClass>
    <ECEntityClass typeName="TestClass" modifier="None">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECArrayProperty propertyName="FavoriteNumbers" typeName="int"/>
      <ECStructArrayProperty propertyName="Addresses" typeName="Location"/>
    </ECEntityClass>
  </ECSchema>`;

  const schemaFileName = "NullBehaviorsTest.01.00.00.xml";
  const iModelFileName = "NullBehaviorsTest.bim";
  const subDirName = "NullBehaviors";
  const iModelPath = IModelTestUtils.prepareOutputFile(subDirName, iModelFileName);
  const categoryName = "NullBehaviorsCategory";

  before(async () => {
    const testSchemaPath = IModelTestUtils.prepareOutputFile(subDirName, schemaFileName);
    IModelJsFs.writeFileSync(testSchemaPath, testSchema);

    const imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "NullBehaviorsTest" } });
    await imodel.importSchemas([testSchemaPath]);
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName);
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, categoryName,
        new SubCategoryAppearance({ color: ColorDef.create("rgb(255,0,0)").toJSON() }));

    imodel.saveChanges();
    imodel.close();
  });

  it("validates arrays to contain null values", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "struct_array_contain_nulls.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName)!;
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    const expectedProps = initElemProps(imodel, newModelId, spatialCategoryId, {
      addresses: [null, { city: "Pune", zip: 28 }],
      favoriteNumbers: [1, 44, 31, null, 81, 19],
    }) as TestElement;

    // Insert an element containing a struct array with at least one null value
    const geomElement = imodel.elements.createElement(expectedProps);
    const id = imodel.elements.insertElement(geomElement.toJSON());
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    imodel.saveChanges();

    // Verify the properties of the inserted element
    const actualValue = imodel.elements.getElementProps<TestElement>(id);
    expect(actualValue.addresses.length).to.equal(2);
    expect(actualValue.addresses).to.equal([undefined, { city: "Pune", zip: 28 }]);
    expect(actualValue.favoriteNumbers.length).to.equal(6);
    expect(actualValue.favoriteNumbers).to.equal([1, 44, 31, undefined, 81, 19]);

    imodel.close();
  });
});
