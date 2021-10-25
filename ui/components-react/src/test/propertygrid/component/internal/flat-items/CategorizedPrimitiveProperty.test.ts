/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { MutableCategorizedPrimitiveProperty } from "../../../../../components-react/propertygrid/internal/flat-items/MutableCategorizedPrimitiveProperty";
import TestUtils from "../../../../TestUtils";
import { FlatGridTestUtils as GridUtils } from "./FlatGridTestUtils";

describe("CategorizedPrimitiveProperty", () => {
  describe("Should correctly initialize categorized primitive property", () => {
    it("Should correctly initialize categorized array property", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");

      expect(() => new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", -1)).to.throw(Error, "Depth cannot be negative");
    });

    it("Should correctly initialize categorized primitive property with overrides", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");

      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      GridUtils.assertPropertyEquals(property, propertyRecord);
      expect(property.depth).to.be.equal(0);
      expect(property.parentSelectionKey).to.be.equal("Cat1");
      expect(property.parentCategorySelectionKey).to.be.equal("Cat1");
    });

    it("Should correctly initialize categorized primitive property with overrides", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");

      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1_Array", "Cat1", 1, "Prop_4", "[5]");

      GridUtils.assertPropertyEquals(property, propertyRecord, "Prop_4", "[5]");
      expect(property.depth).to.be.equal(1);
      expect(property.parentSelectionKey).to.be.equal("Cat1_Array");
      expect(property.parentCategorySelectionKey).to.be.equal("Cat1");
    });

    it("Should throw when initializing categorized primitive property with struct record", () => {
      const propertyRecord = TestUtils.createStructProperty("CADID1");

      const property = () => new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      expect(property).to.throw(Error, "Record with incorrect value format passed to property: expected Primitive, got Struct");
    });

    it("Should throw when initializing categorized primitive property with array record", () => {
      const propertyRecord = TestUtils.createArrayProperty("CADID1");

      const property = () => new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      expect(property).to.throw(Error, "Record with incorrect value format passed to property: expected Primitive, got Array");
    });

  });

  describe("isExpanded", () => {
    const records = [
      TestUtils.createPrimitiveStringProperty("Prop", "Prop Value"),
      TestUtils.createPrimitiveStringProperty("Prop", "Prop Value", undefined, undefined, false),
      TestUtils.createPrimitiveStringProperty("Prop", "Prop Value", undefined, undefined, true),
    ];
    for (const propertyRecord of records) {
      it(`isExpanded should return ${!!propertyRecord.autoExpand} when autoExpand: ${propertyRecord.autoExpand} `, () => {
        const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

        const isExpanded = property.isExpanded;

        expect(isExpanded).to.be.equal(!!propertyRecord.autoExpand);
      });
    }
  });

  describe("getSelf", () => {
    it("Should return self when getSelf called", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      const children = property.getSelf();

      expect(children).to.be.equal(property);
    });
  });

  describe("getChildren", () => {
    it("Should return empty array when getChildren called", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      const children = property.getChildren();

      expect(children).to.deep.equal([]);
    });
  });

  describe("getDescendantsAndSelf", () => {
    it("Should return self when getDescendantsAndSelf called", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      const descendants = property.getDescendantsAndSelf();

      expect(descendants).to.deep.equal([property]);
    });
  });

  describe("getVisibleDescendantsAndSelf", () => {
    it("Should return self when getVisibleDescendantsAndSelf called", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      const visibleDescendants = property.getVisibleDescendantsAndSelf();

      expect(visibleDescendants).to.deep.equal([property]);
    });
  });

  describe("getLastVisibleDescendantOrSelf", () => {
    it("Should return self when getLastVisibleDescendantOrSelf called", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      const lastVisibleDescendant = property.getLastVisibleDescendantOrSelf();

      expect(lastVisibleDescendant).to.deep.equal(property);
    });
  });

  describe("lastInNumberOfCategories", () => {
    it("Should have default of 0", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      expect(property.lastInNumberOfCategories).to.equal(0);
    });

    it("Should correctly set lastInNumberOfCategories", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      property.lastInNumberOfCategories = 3;

      expect(property.lastInNumberOfCategories).to.equal(3);
    });
  });

  describe("isLastInRootCategory", () => {
    it("Should have default of false", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      expect(property.isLastInRootCategory).to.equal(false);
    });

    it("Should correctly set isLastInRootCategory", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("Prop", "Prop Value");
      const property = new MutableCategorizedPrimitiveProperty(propertyRecord, "Cat1", "Cat1", 0);

      property.isLastInRootCategory = true;

      expect(property.isLastInRootCategory).to.equal(true);
    });
  });
});
