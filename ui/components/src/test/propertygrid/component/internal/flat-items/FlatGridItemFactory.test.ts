/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../../../../TestUtils.js";
import { FlatGridItemType } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableFlatGridItem.js";
import { FlatGridTestUtils, FlatGridTestUtils as GridUtils } from "./FlatGridTestUtils.js";
import { MutableGridItemFactory } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableGridItemFactory.js";

describe("FlatGridItemFactory", () => {
  describe("gridItemToModelGridItem", () => {
    let factory: MutableGridItemFactory;
    beforeEach(() => {
      factory = new MutableGridItemFactory();
    });

    describe("createGridCategory", () => {
      it("Should create category without parent correctly", () => {
        const category = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        const gridCategory = factory.createGridCategory(category, recordsDict);

        FlatGridTestUtils.assertCategoryEquals(gridCategory, category);

        expect(gridCategory.depth).to.be.equal(0);
      });

      it("Should create category with parent correctly", () => {
        const category = { name: "Cat1-1-1", label: "Cat 1-1-1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        const gridCategory = factory.createGridCategory(category, recordsDict, "Parent1_Parent1-1", 2);

        FlatGridTestUtils.assertCategoryEquals(gridCategory, category);

        expect(gridCategory.depth).to.be.equal(2);
      });
    });

    describe("createCategorizedProperty", () => {
      const recordsToTest = [
        TestUtils.createPrimitiveStringProperty("Prop", "Prop Value"),
        TestUtils.createArrayProperty("Prop", [
          TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
          TestUtils.createStructProperty("CADID1_2"),
          TestUtils.createArrayProperty("CADID1_3"),
        ]),
        TestUtils.createStructProperty("Prop", {
          CADID1_1: TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
          CADID1_2: TestUtils.createStructProperty("CADID1_2"),
          CADID1_3: TestUtils.createArrayProperty("CADID1_3"),
        }),
      ];

      for (const record of recordsToTest) {
        const gridType = GridUtils.valueTypeToFlatGridType(record.value.valueFormat);
        const gridTypeString = FlatGridItemType[gridType];

        it(`Should create ${gridTypeString} correctly`, () => {
          const overrideName = `${record.property.name}_2`;
          const overrideDisplayLabel = "[3]";

          const categorizedProperty = factory.createCategorizedProperty(record, "Cat1-Array", "Cat1", 1, overrideName, overrideDisplayLabel);

          expect(categorizedProperty.depth).to.equal(1);

          FlatGridTestUtils.assertPropertyEquals(categorizedProperty, record, overrideName, overrideDisplayLabel);
        });
      }
    });
  });
});
