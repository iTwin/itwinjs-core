/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import { createRandomPrimitiveField } from "@bentley/presentation-common/lib/test/_helpers/random";
import { FavoritePropertiesManager, FavoritePropertiesScope, Presentation } from "@bentley/presentation-frontend";
import {
  ArrayValue, PrimitiveValue, PropertyDescription, PropertyEditorInfo, PropertyRecord, PropertyValueFormat, StandardTypeNames, StructValue,
} from "@bentley/ui-abstract";
import { IPresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";
import { FavoritePropertiesDataFilterer } from "../../presentation-components/propertygrid/FavoritePropertiesDataFilterer";

function createPrimitiveStringProperty(name: string, rawValue: string, displayValue: string = rawValue.toString(), editorInfo?: PropertyEditorInfo, autoExpand?: boolean) {
  const value: PrimitiveValue = {
    displayValue,
    value: rawValue,
    valueFormat: PropertyValueFormat.Primitive,
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.String,
  };

  if (editorInfo)
    description.editor = editorInfo;

  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  if (property.autoExpand === undefined)
    delete property.autoExpand;

  return property;
}

function createArrayProperty(name: string, items?: PropertyRecord[], autoExpand?: boolean) {
  if (!items)
    items = [];

  const value: ArrayValue = {
    items,
    valueFormat: PropertyValueFormat.Array,
    itemsTypeName: items.length !== 0 ? items[0].property.typename : "string",
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.Array,
  };
  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  return property;
}

function createStructProperty(name: string, members?: { [name: string]: PropertyRecord }, autoExpand?: boolean) {
  if (!members)
    members = {};

  const value: StructValue = {
    members,
    valueFormat: PropertyValueFormat.Struct,
  };

  const description: PropertyDescription = {
    displayLabel: name,
    name,
    typename: StandardTypeNames.Struct,
  };
  const property = new PropertyRecord(value, description);
  property.isReadonly = false;
  property.autoExpand = autoExpand;
  return property;
}

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
    matchingField = createRandomPrimitiveField();

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
        matchingField = createRandomPrimitiveField();
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: false });
      });

      it(`Should not match propertyRecord when record is not favorite and has non favorite parents (type: ${recordType})`, async () => {
        isFavoriteStub.returns(false);
        matchingField = createRandomPrimitiveField();
        const matchResult = await filterer.recordMatchesFilter(record, [createStructProperty("Struct"), createArrayProperty("Array")]);
        expect(matchResult).to.deep.eq({ matchesFilter: false });
      });

      it(`Should match propertyRecord when record is favorite and has no parents (type: ${recordType})`, async () => {
        isFavoriteStub.returns(true);
        matchingField = createRandomPrimitiveField();
        const matchResult = await filterer.recordMatchesFilter(record, []);
        expect(matchResult).to.deep.eq({ matchesFilter: true, shouldExpandNodeParents: true });
      });

      it(`Should match propertyRecord when record is not favorite and has favorite parents (type: ${recordType})`, async () => {
        const favoriteParentRecord = createStructProperty("FavoriteStruct");
        const favoriteParentField = createRandomPrimitiveField();
        mockDataProvider.reset();
        mockDataProvider.setup(async (x) => x.getFieldByPropertyRecord(moq.It.isAny())).returns(async (argRecord: PropertyRecord) => {
          if (argRecord.property.name === favoriteParentRecord.property.name)
            return favoriteParentField;
          return createRandomPrimitiveField();
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
