/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import type { PrimitiveValue, PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { DisplayValuePropertyDataFilterer } from "../../../../components-react/propertygrid/dataproviders/filterers/DisplayValuePropertyDataFilterer";
import { FilteredType } from "../../../../components-react/propertygrid/dataproviders/filterers/PropertyDataFiltererBase";
import { TestUtils } from "../../../TestUtils";

describe("DisplayValuePropertyDataFilterer", () => {

  describe("When filter text not set", () => {
    const recordsToTest: PropertyRecord[] = [
      TestUtils.createPrimitiveStringProperty("Property", "value1", undefined),
      TestUtils.createPrimitiveStringProperty("Property", "value1", ""),
      TestUtils.createPrimitiveStringProperty("Property", "value1", faker.random.word()),
      TestUtils.createArrayProperty("Array"),
      TestUtils.createStructProperty("Struct"),
    ];

    describe("[get] filterText", () => {
      it(`Should return empty string`, () => {
        const filterer = new DisplayValuePropertyDataFilterer();
        expect(filterer.filterText).to.be.equal("");
      });

      it(`Should return string which was set in the constructor`, () => {
        const filterer = new DisplayValuePropertyDataFilterer("test");
        expect(filterer.filterText).to.be.equal("test");
      });
    });

    it(`Should return filtering as disabled`, () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      expect(filterer.isActive).to.be.false;
    });

    for (const record of recordsToTest) {
      const recordType = PropertyValueFormat[record.value.valueFormat];
      const displayValue = (record.value as any).displayValue ?? "undefined";

      it(`Should always match propertyRecord (type: ${recordType}, displayValue: ${displayValue})`, async () => {
        const filterer = new DisplayValuePropertyDataFilterer();

        const matchResult = await filterer.recordMatchesFilter(record);
        expect(matchResult).to.deep.eq({ matchesFilter: true });
      });
    }

    it(`Should return 'matchesFilter: true' when calling categoryMatchesFilter`, async () => {
      const filterer = new DisplayValuePropertyDataFilterer();

      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: true });
    });
  });

  describe("When filter text set", () => {
    it("Should return lowercase string", () => {
      const filterer = new DisplayValuePropertyDataFilterer();

      const expectedText = faker.random.word();
      filterer.filterText = expectedText;

      expect(filterer.filterText).to.be.equal(expectedText.toLowerCase());
    });

    it("Should return filtering as enabled", () => {
      const filterer = new DisplayValuePropertyDataFilterer();

      filterer.filterText = faker.random.word();

      expect(filterer.isActive).to.be.true;
    });

    it("Should return false when given struct record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createStructProperty("Struct");

      filterer.filterText = "Struct";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should return false when calling `categoryMatchesFilter`", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();

      filterer.filterText = "test";
      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given array record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createArrayProperty("Array");

      filterer.filterText = "ArRAy";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given undefined display value property record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value");
      (record.value as PrimitiveValue).displayValue = undefined;

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given empty display value property record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value", "");

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given non matching property record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value", "SomeDisplayLabel");

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should match when given partially matching property record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value", "DisplaySomeFilteredValue");

      filterer.filterText = "someFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Value] });
    });

    it("Should match when given fully matching property record", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value", "DisplaySomeFilteredValue");

      filterer.filterText = "displaySomefilteredValue";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Value] });
    });

    it("Should match several times when given property record with repeated filter pattern", async () => {
      const filterer = new DisplayValuePropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value", "DisplaySomeFilteredName");

      filterer.filterText = "mE";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: 2, filteredTypes: [FilteredType.Value] });
    });
  });

  describe("raising `onFilterChanged` event", () => {

    const spy = sinon.spy();
    let filterer: DisplayValuePropertyDataFilterer;

    beforeEach(() => {
      filterer = new DisplayValuePropertyDataFilterer();
      filterer.onFilterChanged.addListener(spy);
    });

    it("doesn't raise event when filter doesn't change", () => {
      filterer.filterText = "";
      expect(spy).to.not.be.called;

      filterer.filterText = "    ";
      expect(spy).to.not.be.called;

      filterer.filterText = "AAA";
      spy.resetHistory();

      filterer.filterText = "AAA";
      expect(spy).to.not.be.called;

      filterer.filterText = "aaa";
      expect(spy).to.not.be.called;
    });

    it("raises event when filter changes", () => {
      filterer.filterText = "a";
      expect(spy).to.be.calledOnce;

      filterer.filterText = "b";
      expect(spy).to.be.calledTwice;
    });

  });

});
