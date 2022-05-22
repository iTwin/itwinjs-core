/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import { createTestSimpleContentField } from "@itwin/presentation-common/lib/cjs/test";
import { FavoritePropertiesManager, FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { IPresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";
import { FavoritePropertiesDataFilterer } from "../../presentation-components/propertygrid/FavoritePropertiesDataFilterer";
import { createArrayProperty, createPrimitiveStringProperty, createStructProperty } from "../_helpers/Properties";

describe("FavoritePropertiesDataFilterer", () => {
  let mockDataProvider: moq.IMock<IPresentationPropertyDataProvider>;
  let matchingField: Field | undefined;
  beforeEach(() => {
    mockDataProvider = moq.Mock.ofType<IPresentationPropertyDataProvider>();
    mockDataProvider.setup(async (x) => x.getFieldByPropertyRecord(moq.It.isAny())).returns(async () => matchingField);
    mockDataProvider.setup((x) => x.imodel).returns(() => moq.Mock.ofType<IModelConnection>().object);
    matchingField = undefined;
  });

  it("uses FavoritePropertiesManager to determine favorites if callback is not provided through props", async () => {
    const record = createPrimitiveStringProperty("Property", "Value");
    matchingField = createTestSimpleContentField();

    const managerMock = moq.Mock.ofType<FavoritePropertiesManager>();
    managerMock.setup((x) => x.has(matchingField!, moq.It.isAny(), FavoritePropertiesScope.Global)).returns(() => true).verifiable();
    Presentation.setFavoritePropertiesManager(managerMock.object);

    const filterer = new FavoritePropertiesDataFilterer({
      source: mockDataProvider.object,
      favoritesScope: FavoritePropertiesScope.Global,
      isActive: true,
    });
    const matchResult = await filterer.recordMatchesFilter(record, []);
    managerMock.verifyAll();
    expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true });
  });

  it("raises `onFilterChanged` event when filterer is enabled / disabled", () => {
    const filterer = new FavoritePropertiesDataFilterer({
      source: mockDataProvider.object,
      favoritesScope: FavoritePropertiesScope.Global,
    });
    const spy = sinon.spy();
    filterer.onFilterChanged.addListener(spy);

    filterer.isActive = false;
    expect(spy).to.not.be.called;

    filterer.isActive = true;
    expect(spy).to.be.calledOnce;

    filterer.isActive = true;
    expect(spy).to.be.calledOnce;

    filterer.isActive = false;
    expect(spy).to.be.calledTwice;
  });

  describe("when filtering is disabled", () => {
    const recordsToTest: PropertyRecord[] = [
      createPrimitiveStringProperty("Property", "value1", undefined),
      createPrimitiveStringProperty("Property", "value1", ""),
      createPrimitiveStringProperty("Property", "value1", faker.random.word()),
      createArrayProperty("Array"),
      createStructProperty("Struct"),
    ];

    let filterer: FavoritePropertiesDataFilterer;
    beforeEach(() => {
      filterer = new FavoritePropertiesDataFilterer({
        source: mockDataProvider.object,
        favoritesScope: FavoritePropertiesScope.IModel,
        isFavorite: () => false,
      });
      expect(filterer.isActive).to.be.false;
    });

    for (const record of recordsToTest) {
      const recordType = PropertyValueFormat[record.value.valueFormat];
      it(`Should always match propertyRecord (type: ${recordType})`, async () => {
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: true });
      });
    }

    it(`Should always return 'matchesFilter: true' when calling categoryMatchesFilter`, async () => {
      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: true });
    });
  });

  describe("when filtering is enabled", () => {
    const recordsToTest: PropertyRecord[] = [
      createPrimitiveStringProperty("Property", "value1"),
      createArrayProperty("Array"),
      createStructProperty("Struct"),
    ];

    const isFavoriteStub = sinon.stub();
    let filterer: FavoritePropertiesDataFilterer;
    beforeEach(() => {
      isFavoriteStub.reset();
      filterer = new FavoritePropertiesDataFilterer({
        source: mockDataProvider.object,
        favoritesScope: FavoritePropertiesScope.IModel,
        isActive: true,
        isFavorite: isFavoriteStub,
      });
    });

    for (const record of recordsToTest) {
      const recordType = PropertyValueFormat[record.value.valueFormat];

      it(`Should not match propertyRecord when getFieldByPropertyRecord cannot find record field (type: ${recordType})`, async () => {
        matchingField = undefined;
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: false });
      });

      it(`Should not match propertyRecord when record is not favorite and has no parents (type: ${recordType})`, async () => {
        isFavoriteStub.returns(false);
        matchingField = createTestSimpleContentField();
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: false });
      });

      it(`Should not match propertyRecord when record is not favorite and has non favorite parents (type: ${recordType})`, async () => {
        isFavoriteStub.returns(false);
        matchingField = createTestSimpleContentField();
        const matchResult = await filterer.recordMatchesFilter(record, [createStructProperty("Struct"), createArrayProperty("Array")]);
        expect(matchResult).to.deep.eq({ matchesFilter: false });
      });

      it(`Should match propertyRecord when record is favorite and has no parents (type: ${recordType})`, async () => {
        isFavoriteStub.returns(true);
        matchingField = createTestSimpleContentField();
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true });
      });

      it(`Should match propertyRecord when record is not favorite and has favorite parents (type: ${recordType})`, async () => {
        const favoriteParentRecord = createStructProperty("FavoriteStruct");
        const favoriteParentField = createTestSimpleContentField();
        mockDataProvider.reset();
        mockDataProvider.setup(async (x) => x.getFieldByPropertyRecord(moq.It.isAny())).returns(async (argRecord: PropertyRecord) => {
          if (argRecord.property.name === favoriteParentRecord.property.name)
            return favoriteParentField;
          return createTestSimpleContentField();
        });

        isFavoriteStub.returns(false);
        isFavoriteStub.withArgs(favoriteParentField, sinon.match.any, sinon.match.any).returns(true);

        const matchResult = await filterer.recordMatchesFilter(record, [favoriteParentRecord]);
        expect(matchResult).to.deep.eq({ matchesFilter: true });
      });
    }

    it("Should not match when calling `categoryMatchesFilter`", async () => {
      const matchResult = await filterer.categoryMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

  });
});
