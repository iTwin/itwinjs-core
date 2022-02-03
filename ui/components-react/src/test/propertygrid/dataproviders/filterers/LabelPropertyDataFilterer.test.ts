/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import type { PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { LabelPropertyDataFilterer } from "../../../../components-react/propertygrid/dataproviders/filterers/LabelPropertyDataFilterer";
import { FilteredType } from "../../../../components-react/propertygrid/dataproviders/filterers/PropertyDataFiltererBase";
import { TestUtils } from "../../../TestUtils";

describe("LabelPropertyDataFilterer", () => {

  describe("When filter text not set", () => {
    const recordsToTest: PropertyRecord[] = [
      TestUtils.createPrimitiveStringProperty(faker.random.word(), "value1"),
      TestUtils.createArrayProperty(faker.random.word()),
      TestUtils.createStructProperty(faker.random.word()),
    ];

    describe("[get] filterText", () => {
      it(`Should return empty string`, () => {
        const filterer = new LabelPropertyDataFilterer();
        expect(filterer.filterText).to.be.equal("");
      });

      it(`Should return string which was set in the constructor`, () => {
        const filterer = new LabelPropertyDataFilterer("test");
        expect(filterer.filterText).to.be.equal("test");
      });
    });

    it(`Should return filtering as disabled`, () => {
      const filterer = new LabelPropertyDataFilterer();
      expect(filterer.isActive).to.be.false;
    });

    for (const record of recordsToTest) {
      const recordType = PropertyValueFormat[record.value.valueFormat];
      const displayValue = (record.value as any).displayValue ?? "undefined";

      it(`Should always match propertyRecord (type: ${recordType}, displayValue: ${displayValue})`, async () => {
        const filterer = new LabelPropertyDataFilterer();

        const matchResult = await filterer.recordMatchesFilter(record);
        expect(matchResult).to.deep.eq({ matchesFilter: true });
      });
    }

    it(`Should always return 'matchesFilter: true' when calling categoryMatchesFilter`, async () => {
      const filterer = new LabelPropertyDataFilterer();

      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: true });
    });
  });

  describe("When filter text set", () => {
    it("Should return lowercase string", () => {
      const filterer = new LabelPropertyDataFilterer();

      const expectedText = faker.random.word();
      filterer.filterText = expectedText;

      expect(filterer.filterText).to.be.equal(expectedText.toLowerCase());
    });

    it("Should return filtering as enabled", () => {
      const filterer = new LabelPropertyDataFilterer();

      filterer.filterText = faker.random.word();

      expect(filterer.isActive).to.be.true;
    });

    it("Should not match when calling `categoryMatchesFilter`", async () => {
      const filterer = new LabelPropertyDataFilterer();

      filterer.filterText = "test";
      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given empty display value property record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("", "Value");

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given non matching property record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("Property", "Value");

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should match when given partially matching property record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("DisplaySomeFilteredName", "Value");

      filterer.filterText = "someFilter";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Label] });
    });

    it("Should match when given fully matching property record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("DisplaySomeFilteredName", "Value");

      filterer.filterText = "displaySomefilteredNaMe";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Label] });
    });

    it("Should match when given matching struct record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createStructProperty("Struct");

      filterer.filterText = "StrUCt";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Label] });
    });

    it("Should match when given matching array record", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createArrayProperty("Array");

      filterer.filterText = "ArRAy";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Label] });
    });

    it("Should match several times when given property record with repeated filter pattern", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createPrimitiveStringProperty("DisplaySomeFilteredName", "Value");

      filterer.filterText = "mE";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 2, filteredTypes: [FilteredType.Label] });
    });

    it("Should match several times when given array record with repeated filter pattern", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createArrayProperty("ArrayAr");

      filterer.filterText = "aR";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 2, filteredTypes: [FilteredType.Label] });
    });

    it("Should match several times when given struct record with repeated filter pattern", async () => {
      const filterer = new LabelPropertyDataFilterer();
      const record = TestUtils.createStructProperty("StructsTSt");

      filterer.filterText = "ST";
      const matchResult = await filterer.recordMatchesFilter(record);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 3, filteredTypes: [FilteredType.Label] });
    });
  });

  describe("raising `onFilterChanged` event", () => {

    const spy = sinon.spy();
    let filterer: LabelPropertyDataFilterer;

    beforeEach(() => {
      filterer = new LabelPropertyDataFilterer();
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
