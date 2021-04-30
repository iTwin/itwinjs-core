/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { MutableCustomGridCategory } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableCustomGridCategory";
import { FlatGridItemType } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableFlatGridItem";
import { MutableGridItemFactory } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableGridItemFactory";
import { PropertyCategory } from "../../../../../ui-components/propertygrid/PropertyDataProvider";
import TestUtils from "../../../../TestUtils";
import { FlatGridTestUtils } from "./FlatGridTestUtils";

describe("FlatGridItemFactory", () => {
  describe("gridItemToModelGridItem", () => {
    let factory: MutableGridItemFactory;
    beforeEach(() => {
      factory = new MutableGridItemFactory();
    });

    describe("createGridCategory", () => {
      it("creates category without parent correctly", () => {
        const category = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = FlatGridTestUtils.constructCategoryRecordsDict([category]);

        const gridCategory = factory.createGridCategory(category, recordsDict);

        FlatGridTestUtils.assertCategoryEquals(gridCategory, category);

        expect(gridCategory.depth).to.be.equal(0);
      });

      it("creates category with parent correctly", () => {
        const category = { name: "Cat1-1-1", label: "Cat 1-1-1", expand: false };
        const recordsDict = FlatGridTestUtils.constructCategoryRecordsDict([category]);

        const gridCategory = factory.createGridCategory(category, recordsDict, "Parent1_Parent1-1", 2);

        FlatGridTestUtils.assertCategoryEquals(gridCategory, category);

        expect(gridCategory.depth).to.be.equal(2);
      });

      it("creates mutable custom category renderer", () => {
        const category: PropertyCategory = {
          name: "test_category",
          label: "test_category",
          expand: false,
          renderer: { name: "test_renderer" },
        };
        const recordsDict = FlatGridTestUtils.constructCategoryRecordsDict([category]);

        const gridCategory = factory.createGridCategory(category, recordsDict, undefined, 0);

        expect(gridCategory instanceof MutableCustomGridCategory).to.be.true;
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
        const gridType = FlatGridTestUtils.valueTypeToFlatGridType(record.value.valueFormat);
        const gridTypeString = FlatGridItemType[gridType];

        it(`creates ${gridTypeString} correctly`, () => {
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
