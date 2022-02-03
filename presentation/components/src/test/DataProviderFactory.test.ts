/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import type { RulesetsFactory } from "@itwin/presentation-common";
import { Content, Item } from "@itwin/presentation-common";
import { createRandomRuleset, createTestContentDescriptor, createTestSimpleContentField } from "@itwin/presentation-common/lib/cjs/test";
import type { PresentationManager } from "@itwin/presentation-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import { TypeConverter, TypeConverterManager } from "@itwin/components-react";
import type { DataProvidersFactoryProps, IPresentationPropertyDataProvider} from "../presentation-components";
import {
  DataProvidersFactory, PresentationTableDataProvider,
} from "../presentation-components";
import { createRandomPropertyRecord, mockPresentationManager } from "./_helpers/UiComponents";

describe("DataProvidersFactory", () => {

  let presentationManagerMock: moq.IMock<PresentationManager>;
  let propertiesProvider: moq.IMock<IPresentationPropertyDataProvider>;
  let factory: DataProvidersFactory | undefined;
  let props: DataProvidersFactoryProps | undefined;

  beforeEach(() => {
    props = undefined;
    factory = undefined;
    propertiesProvider = moq.Mock.ofType<IPresentationPropertyDataProvider>();
    presentationManagerMock = mockPresentationManager().presentationManager;
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  afterEach(() => {
    sinon.restore();
    Presentation.terminate();
  });

  const getFactory = (): DataProvidersFactory => {
    if (!factory)
      factory = new DataProvidersFactory(props);
    return factory;
  };

  describe("createSimilarInstancesTableDataProvider", () => {

    it("throws when there's no content", async () => {
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => undefined);
      await expect(getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, createRandomPropertyRecord(), {})).to.eventually.be.rejected;
    });

    it("throws when content has no records", async () => {
      const content = new Content(createTestContentDescriptor({ fields: [] }), []);
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => content);
      await expect(getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, createRandomPropertyRecord(), {})).to.eventually.be.rejected;
    });

    it("throws when content descriptor has no field with property record's name", async () => {
      const record = createRandomPropertyRecord();
      const content = new Content(createTestContentDescriptor({ fields: [] }), []);
      content.contentSet.push(new Item([], "", "", undefined, {}, {}, []));
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => content);
      await expect(getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {})).to.eventually.be.rejected;
    });

    it("creates a provider with similar instances ruleset", async () => {
      const ruleset = await createRandomRuleset();

      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({ fields: [] });
      descriptor.fields.push(field);
      const contentItem = new Item([], "", "", undefined, { [field.name]: "test value" }, { [field.name]: "test display value" }, []);
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => new Content(descriptor, [contentItem]));

      const record = createRandomPropertyRecord();
      record.property.name = field.name;

      const typeConverterStub = sinon.createStubInstance(TypeConverter);
      typeConverterStub.convertToString.returns("test str");
      const getConverterStub = sinon.stub(TypeConverterManager, "getConverter").returns(typeConverterStub);

      const rulesetsFactoryMock = moq.Mock.ofType<RulesetsFactory>();
      props = { rulesetsFactory: rulesetsFactoryMock.object };
      rulesetsFactoryMock
        .setup(async (x) => x.createSimilarInstancesRuleset(field, contentItem, moq.It.isAny()))
        .returns(async (_f, _c, cb) => ({ ruleset, description: await cb("a", "b", "c") }));

      const dataProvider = await getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {});
      expect(getConverterStub).to.be.calledOnceWith("a");
      expect(typeConverterStub.convertToString).to.be.calledOnceWith("b");
      expect(dataProvider).to.be.instanceOf(PresentationTableDataProvider);
      expect(dataProvider.rulesetId).to.eq(ruleset.id);
      expect(dataProvider.description).to.eq("test str");
      expect((dataProvider as any).shouldRequestContentForEmptyKeyset()).to.be.true;
    });

    it("uses record's display value for navigation properties", async () => {
      const ruleset = await createRandomRuleset();

      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({ fields: [] });
      descriptor.fields.push(field);
      const contentItem = new Item([], "", "", undefined, { [field.name]: "test value" }, { [field.name]: "test display value" }, []);
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => new Content(descriptor, [contentItem]));

      const record = createRandomPropertyRecord();
      record.property.name = field.name;

      const getConverterStub = sinon.spy(TypeConverterManager, "getConverter");

      const rulesetsFactoryMock = moq.Mock.ofType<RulesetsFactory>();
      props = { rulesetsFactory: rulesetsFactoryMock.object };
      rulesetsFactoryMock
        .setup(async (x) => x.createSimilarInstancesRuleset(field, contentItem, moq.It.isAny()))
        .returns(async (_f, _c, cb) => ({ ruleset, description: await cb("navigation", "b", "c") }));

      const dataProvider = await getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {});
      expect(getConverterStub).to.not.be.called;
      expect(dataProvider.description).to.eq("c");
    });

    it("uses record's display value for double properties", async () => {
      const ruleset = await createRandomRuleset();
      const rawValue = 1.123;
      const displayValue = "1.12 m2";

      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({ fields: [] });
      descriptor.fields.push(field);
      const contentItem = new Item([], "", "", undefined, { [field.name]: rawValue }, { [field.name]: displayValue }, []);
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => new Content(descriptor, [contentItem]));

      const record = createRandomPropertyRecord();
      record.property.name = field.name;

      const getConverterStub = sinon.spy(TypeConverterManager, "getConverter");

      const rulesetsFactoryMock = moq.Mock.ofType<RulesetsFactory>();
      props = { rulesetsFactory: rulesetsFactoryMock.object };
      rulesetsFactoryMock
        .setup(async (x) => x.createSimilarInstancesRuleset(field, contentItem, moq.It.isAny()))
        .returns(async (_f, _c, cb) => ({ ruleset, description: await cb("double", rawValue, displayValue) }));

      const dataProvider = await getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {});
      expect(getConverterStub).to.not.be.called;
      expect(dataProvider.description).to.eq(displayValue);
    });

  });

});
