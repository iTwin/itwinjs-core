/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { MutableCategorizedStructProperty } from "../../../../../components-react/propertygrid/internal/flat-items/MutableCategorizedStructProperty";
import { FlatGridItemType } from "../../../../../components-react/propertygrid/internal/flat-items/MutableFlatGridItem";
import { MutableGridItemFactory } from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import TestUtils from "../../../../TestUtils";
import { FlatGridTestUtils as GridUtils } from "./FlatGridTestUtils";

describe("CategorizedStructProperty", () => {
  let factoryStub: sinon.SinonStubbedInstance<MutableGridItemFactory>;
  beforeEach(() => {
    factoryStub = sinon.createStubInstance(MutableGridItemFactory);
  });

  describe("Should correctly initialize categorized array property", () => {
    it("Should correctly initialize categorized array property", () => {
      const propertyRecord = TestUtils.createStructProperty("CADID1", {});

      expect(() => new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", -1, factoryStub)).to.throw(Error, "Depth cannot be negative");
    });

    it("Should correctly initialize categorized struct property", () => {
      const propertyRecord = TestUtils.createStructProperty("CADID1", {});

      const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

      expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(0);

      GridUtils.assertPropertyEquals(property, propertyRecord);
      expect(property.depth).to.be.equal(0);

      expect(property.parentSelectionKey).to.be.equal("Cat1");
      expect(property.parentCategorySelectionKey).to.be.equal("Cat1");
    });

    it("Should correctly initialize categorized struct property with overrides", () => {
      const propertyRecord = TestUtils.createStructProperty("CADID1", {});

      const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1_Array", "Cat1", 1, factoryStub, "CADID1_2", "[3]");

      expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(0);

      GridUtils.assertPropertyEquals(property, propertyRecord, "CADID1_2", "[3]");
      expect(property.depth).to.be.equal(1);

      expect(property.parentSelectionKey).to.be.equal("Cat1_Array");
      expect(property.parentCategorySelectionKey).to.be.equal("Cat1");
    });

    it("Should throw when initializing categorized struct property with primitive record", () => {
      const propertyRecord = TestUtils.createPrimitiveStringProperty("CADID1", "V1");

      const property = () => new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

      expect(property).to.throw(Error, "Record with incorrect value format passed to property: expected Struct, got Primitive");
    });

    it("Should throw when initializing categorized struct property with array record", () => {
      const propertyRecord = TestUtils.createArrayProperty("CADID1");

      const property = () => new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

      expect(property).to.throw(Error, "Record with incorrect value format passed to property: expected Struct, got Array");
    });

    it("Should correctly initialize categorized array property with children", () => {
      const propertyRecord = TestUtils.createStructProperty("CADID1", {
        CADID1_1: TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
        CADID1_2: TestUtils.createStructProperty("CADID1_2"),
        CADID1_3: TestUtils.createArrayProperty("CADID1_3"),
      });

      GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);

      const expectedParentSelectionKey = "Cat1";
      new MutableCategorizedStructProperty(propertyRecord, expectedParentSelectionKey, expectedParentSelectionKey, 0, factoryStub);

      const arrayChildren = propertyRecord.getChildrenRecords();
      expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(arrayChildren.length);

      factoryStub.createCategorizedProperty.args.forEach((args, index) => {
        const [record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel] = args;
        const expectedRecord = arrayChildren[index];

        expect(parentSelectionKey).to.be.equal(GridUtils.getSelectionKey(propertyRecord, expectedParentSelectionKey));
        expect(parentCategorySelectionKey).to.be.equal(expectedParentSelectionKey);
        expect(depth).to.be.equal(1);
        expect(record).to.be.equal(expectedRecord);
        expect(overrideName).to.be.equal(undefined);
        expect(overrideDisplayLabel).to.be.equal(undefined);
      });
    });
  });

  describe("isExpanded", () => {
    function testIsExpanded(expectedIsExpanded: boolean) {
      it(`isExpanded should return ${expectedIsExpanded} when autoExpand: ${expectedIsExpanded}`, () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {}, expectedIsExpanded);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        const isExpanded = property.isExpanded;
        expect(isExpanded).to.be.equal(propertyRecord.autoExpand);
      });

      it(`isExpanded should return ${expectedIsExpanded} when isExpanded set to: ${expectedIsExpanded}`, () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {});

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = expectedIsExpanded;
        expect(property.isExpanded).to.be.equal(expectedIsExpanded);
      });
    }

    testIsExpanded(false);
    testIsExpanded(true);
  });

  describe("getSelf", () => {
    it("Should return self when getSelf called", () => {
      const propertyRecord = TestUtils.createStructProperty("Prop", {});

      const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

      const self = property.getSelf();

      expect(self).to.be.equal(property);
    });
  });

  describe("Categorized array parent-child tests", () => {
    let structChildren: { [name: string]: PropertyRecord };
    beforeEach(() => {
      structChildren = {
        CADID1_1: TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
        CADID1_2: TestUtils.createStructProperty("CADID1_2"),
        CADID1_3: TestUtils.createArrayProperty("CADID1_3"),
      };
    });

    describe("getChildren", () => {
      it("Should return empty array when struct property has no children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {});

        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        const children = property.getChildren();

        expect(children).to.deep.equal([]);
      });

      it("Should return expected array of children when struct property has children", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        const children = property.getChildren();

        expect(children).to.be.deep.equal(expectedChildren);
      });
    });

    describe("getDescendantsAndSelf", () => {
      it("Should return self when getDescendantsAndSelf called on struct property with no children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {});
        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        const descendants = property.getDescendantsAndSelf();
        expect(descendants).to.deep.equal([property]);
      });

      it("Should return descendants when getDescendantsAndSelf called on struct property with children", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);
        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: true },
        ]);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        expect(property.getDescendantsAndSelf()).to.deep.equal([property, ...expectedDescendants]);
      });

      it("Should not include self when `PropertyRecord.property.hideCompositePropertyLabel`", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);
        propertyRecord.property.hideCompositePropertyLabel = true;

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: true },
        ]);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        expect(property.getDescendantsAndSelf()).to.deep.equal(expectedDescendants);
      });

      it("Should not depend on isExpanded", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);
        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: false },
          { type: FlatGridItemType.Primitive, isVisible: true },
        ]);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = false;
        expect(property.getDescendantsAndSelf()).to.deep.equal([property, ...expectedDescendants]);

        property.isExpanded = true;
        expect(property.getDescendantsAndSelf()).to.deep.equal([property, ...expectedDescendants]);
      });
    });

    describe("getVisibleDescendants", () => {
      it("Should return children even when not expanded when `PropertyRecord.property.hideCompositePropertyLabel` is set", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);
        propertyRecord.property.hideCompositePropertyLabel = true;

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, []);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = false;
        expect(property.getVisibleDescendants()).to.deep.equal(expectedDescendants);
      });
    });

    describe("getVisibleDescendantsAndSelf", () => {
      it("Should return self when called on struct property with no children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {});
        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = false;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal([property]);

        property.isExpanded = true;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal([property]);
      });

      it("Should return self when not expanded and has children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);
        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: true },
          { type: FlatGridItemType.Primitive, isVisible: false },
        ]);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = false;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal([property]);
      });

      it("Should return visible descendants when expanded and has children without descendants", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);
        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedVisibleDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, []);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = true;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal([property, ...expectedVisibleDescendants]);
      });

      it("Should return visible descendants when expanded and has children with descendants", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);
        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedVisibleDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: true },
          { type: FlatGridItemType.Primitive, isVisible: false },
        ]);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = true;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal([property, ...expectedVisibleDescendants]);
      });

      it("Should not include self when `PropertyRecord.property.hideCompositePropertyLabel`", () => {
        const propertyRecord = TestUtils.createStructProperty("CADID1", structChildren);
        propertyRecord.property.hideCompositePropertyLabel = true;

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedVisibleDescendants } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: true },
          { type: FlatGridItemType.Primitive, isVisible: false },
        ]);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);
        property.isExpanded = true;
        expect(property.getVisibleDescendantsAndSelf()).to.deep.equal(expectedVisibleDescendants);
      });
    });

    describe("getLastVisibleDescendantOrSelf", () => {
      it("Should return self when called on struct property with no children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", {});

        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = false;
        expect(property.getLastVisibleDescendantOrSelf()).to.deep.equal(property);

        property.isExpanded = true;
        expect(property.getLastVisibleDescendantOrSelf()).to.deep.equal(property);
      });

      it("Should return self when not expanded and has children", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: true },
          { type: FlatGridItemType.Primitive, isVisible: false },
        ]);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = false;
        expect(property.getLastVisibleDescendantOrSelf()).to.deep.equal(property);
      });

      it("Should return last visible descendant when expanded and has children without descendants", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedLastVisibleDescendant } = GridUtils.setupExpectedDescendants(expectedChildren, []);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = true;
        expect(property.getLastVisibleDescendantOrSelf()).to.deep.equal(expectedLastVisibleDescendant);
      });

      it("Should return last visible descendant when expanded and has children with descendants", () => {
        const propertyRecord = TestUtils.createStructProperty("Prop", structChildren);

        const expectedChildren = GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
        const { expectedLastVisibleDescendant } = GridUtils.setupExpectedDescendants(expectedChildren, [
          { type: FlatGridItemType.Struct, isVisible: true },
          { type: FlatGridItemType.Array, isVisible: true },
          { type: FlatGridItemType.Primitive, isVisible: false },
        ]);

        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        property.isExpanded = true;
        expect(property.getLastVisibleDescendantOrSelf()).to.deep.equal(expectedLastVisibleDescendant);
      });
    });

    describe("lastInNumberOfCategories", () => {
      let propertyRecord: PropertyRecord;
      beforeEach(() => {
        propertyRecord = TestUtils.createStructProperty("Prop", structChildren);
        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
      });

      it("Should have default of 0", () => {
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        expect(property.lastInNumberOfCategories).to.equal(0);
      });

      it("Should correctly set lastInNumberOfCategories", () => {
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        const children = property.getChildren();
        const childrenSpies: sinon.SinonSpy[] = [];
        children.forEach((child) => {
          const spy = sinon.spy();
          childrenSpies.push(spy);

          sinon.replaceSetter(child, "lastInNumberOfCategories", spy);
        });

        property.lastInNumberOfCategories = 3;

        expect(property.lastInNumberOfCategories).to.equal(3);
        const lastSpy = GridUtils.getLast(childrenSpies)!;

        childrenSpies.forEach((spy) => {
          if (spy !== lastSpy)
            expect(spy.notCalled).to.be.true;
        });

        expect(lastSpy.calledOnceWith(3)).to.be.true;
      });
    });

    describe("isLastInRootCategory", () => {
      let propertyRecord: PropertyRecord;
      beforeEach(() => {
        propertyRecord = TestUtils.createStructProperty("Prop", structChildren);
        GridUtils.createCategorizedPropertyStub(propertyRecord.getChildrenRecords(), factoryStub);
      });

      it("Should have default of false", () => {
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        expect(property.isLastInRootCategory).to.equal(false);
      });

      it("Should correctly set isLastInRootCategory", () => {
        const property = new MutableCategorizedStructProperty(propertyRecord, "Cat1", "Cat1", 0, factoryStub);

        const children = property.getChildren();
        const childrenSpies: sinon.SinonSpy[] = [];
        children.forEach((child) => {
          const spy = sinon.spy();
          childrenSpies.push(spy);

          sinon.replaceSetter(child, "isLastInRootCategory", spy);
        });

        property.isLastInRootCategory = true;

        expect(property.isLastInRootCategory).to.equal(true);

        const lastSpy = GridUtils.getLast(childrenSpies)!;
        childrenSpies.forEach((spy) => {
          if (spy !== lastSpy)
            expect(spy.notCalled).to.be.true;
        });

        expect(lastSpy.calledOnceWith(true)).to.be.true;
      });
    });
  });
});
