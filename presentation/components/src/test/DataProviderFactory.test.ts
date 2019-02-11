/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomContent, createRandomRuleset, createRandomDescriptor, createRandomPrimitiveField } from "@bentley/presentation-common/lib/test/_helpers/random";
import { createRandomPropertyRecord } from "./_helpers/UiComponents";
import { IPresentationPropertyDataProvider, PresentationTableDataProvider } from "../presentation-components";
import { DataProvidersFactory, DataProvidersFactoryProps } from "../DataProvidersFactory";
import { RulesetsFactory, Content, Item } from "@bentley/presentation-common";
import { Presentation, PresentationManager } from "@bentley/presentation-frontend";
import RulesetManager from "@bentley/presentation-frontend/lib/RulesetManager";

describe("DataProvidersFactory", () => {

  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const propertiesProvider = moq.Mock.ofType<IPresentationPropertyDataProvider>();
  let factory: DataProvidersFactory | undefined;
  let props: DataProvidersFactoryProps | undefined;

  before(() => {
    Presentation.presentation = presentationManagerMock.object;
  });

  beforeEach(() => {
    props = undefined;
    factory = undefined;
    propertiesProvider.reset();
    presentationManagerMock.reset();
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => moq.Mock.ofType<RulesetManager>().object);
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
      const content = createRandomContent();
      content.contentSet = [];
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => content);
      await expect(getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, createRandomPropertyRecord(), {})).to.eventually.be.rejected;
    });

    it("throws when content descriptor has no field with property record's name", async () => {
      const record = createRandomPropertyRecord();
      const content = createRandomContent();
      content.contentSet.push(new Item([], "", "", undefined, {}, {}, []));
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => content);
      await expect(getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {})).to.eventually.be.rejected;
    });

    it("creates a provider with similar instances ruleset", async () => {
      const ruleset = await createRandomRuleset();
      const description = "Test description";

      const field = createRandomPrimitiveField();
      const descriptor = createRandomDescriptor();
      descriptor.fields.push(field);
      const contentItem = new Item([], "", "", undefined, { [field.name]: "test value" }, { [field.name]: "test display value" }, []);
      const content: Content = {
        descriptor,
        contentSet: [contentItem],
      };
      propertiesProvider.setup(async (x) => x.getContent()).returns(async () => content);

      const record = createRandomPropertyRecord();
      record.property.name = field.name;

      const rulesetsFactoryMock = moq.Mock.ofType<RulesetsFactory>();
      props = { rulesetsFactory: rulesetsFactoryMock.object };
      rulesetsFactoryMock.setup((x) => x.createSimilarInstancesRuleset(field, contentItem)).returns(() => ({ ruleset, description }));

      const dataProvider = await getFactory().createSimilarInstancesTableDataProvider(propertiesProvider.object, record, {});
      expect(dataProvider).to.be.instanceOf(PresentationTableDataProvider);
      expect(dataProvider.rulesetId).to.eq(ruleset.id);
      expect(dataProvider.description).to.eq(description);
    });

  });

});
