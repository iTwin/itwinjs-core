/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as moq from "typemoq";
import { createRandomECInstanceNodeKey, createRandomId, createRandomECInstanceNode, createRandomContent, createRandomLabelDefinition, createRandomDescriptor, createRandomLabelCompositeValue } from "@bentley/presentation-common/lib/test/_helpers/random";
import { Id64 } from "@bentley/bentleyjs-core";
import { RelatedElementProps, ModelProps, ElementProps, Code } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PersistentKeysContainer, InstanceKey, KeySet, Item, Content, LabelDefinition } from "@bentley/presentation-common";
import { PersistenceHelper } from "../presentation-frontend";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";
import { Presentation } from "../Presentation";
import { LocalizationHelper } from "../LocalizationHelper";

describe("LocalizationHelper", () => {
  const i18nMock = moq.Mock.ofType<I18N>();
  let localizationHelper: LocalizationHelper;

  beforeEach(() => {
    i18nMock.reset();
    const resolvedPromise = new Promise<void>((resolve) => resolve());
    i18nMock.setup((x) => x.registerNamespace(moq.It.isAny())).returns((name: string) => new I18NNamespace(name, resolvedPromise));
    localizationHelper = new LocalizationHelper();

    Presentation.i18n = i18nMock.object;
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("translate", () => {

    it("registers locales namespaces only once", async () => {
      await localizationHelper.translate("key");
      await localizationHelper.translate("key");
      i18nMock.verify((x) => x.registerNamespace("BisCore"), moq.Times.once());
      i18nMock.verify((x) => x.registerNamespace("ECPresentation"), moq.Times.once());
      i18nMock.verify((x) => x.registerNamespace("RulesEngine"), moq.Times.once());
    });

    it("does not translate if key not found", async () => {
      const key = "WrongKey";
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = await localizationHelper.translate(key);
      expect(translated).to.be.eq(key);
    });

    it("trims key if needed", async () => {
      const key = "@NotLocalized@";
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = await localizationHelper.translate(key);
      expect(translated).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedNodes", () => {

    it("translates labelDefinition", async () => {
      const node = createRandomECInstanceNode();
      node.labelDefinition!.rawValue = "NotLocalized";
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedNodes([node]);
      expect(node.labelDefinition!.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedContent", () => {

    it("translates contentItem labelDefinitions", async () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.labelDefinition!.rawValue = "NotLocalized";
      const content = new Content(createRandomDescriptor(), [contentItem]);
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.labelDefinition!.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedLabelDefinition", () => {

    it("translates labelDefinition", async () => {
      const labelDefinition = createRandomLabelDefinition();
      labelDefinition.rawValue = "NotLocalized";
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates labelDefinition with composite value", async () => {
      const compositeValue = createRandomLabelCompositeValue();
      compositeValue.values.forEach((value) => {
        value.rawValue = "NotLocalized";
      });
      const labelDefinition: LabelDefinition = {
        displayValue: "Display",
        rawValue: compositeValue,
        typeName: "composite",
      };
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      compositeValue.values.forEach((value) => {
        expect(value.rawValue).to.be.eq("LocalizedValue");
      });

    });

    it("does not translate non string value", async () => {
      const labelDefinition: LabelDefinition = {
        displayValue: "10",
        rawValue: 10,
        typeName: "int",
      };
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq(10);
      i18nMock.verify((x) => x.translate(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

  });

  describe("getLocalizedLabelDefinitions", () => {

    it("translates labelDefinitions", async () => {
      const labelDefinitions = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      labelDefinitions.forEach((labelDefinition) => labelDefinition.rawValue = "NotLocalized");
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      await localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
      labelDefinitions.forEach((labelDefinition) => {
        expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
      });
    });

  });

});
