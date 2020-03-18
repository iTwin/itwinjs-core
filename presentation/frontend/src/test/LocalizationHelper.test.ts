/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as moq from "typemoq";
import { createRandomECInstancesNode, createRandomLabelDefinition, createRandomDescriptor, createRandomLabelCompositeValue } from "@bentley/presentation-common/lib/test/_helpers/random";
import { I18N } from "@bentley/imodeljs-i18n";
import { Item, Content, LabelDefinition } from "@bentley/presentation-common";
import { Presentation } from "../presentation-frontend/Presentation";
import { LocalizationHelper } from "../presentation-frontend/LocalizationHelper";

describe("LocalizationHelper", () => {
  const i18nMock = moq.Mock.ofType<I18N>();
  let localizationHelper: LocalizationHelper;

  beforeEach(() => {
    i18nMock.reset();
    localizationHelper = new LocalizationHelper();
    Presentation.setI18nManager(i18nMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("translate", () => {

    it("does not translate if key not found", () => {
      const key = "WrongKey";
      i18nMock.setup((x) => x.translate("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = localizationHelper.translate(key);
      expect(translated).to.be.eq(key);
    });

    it("trims key", () => {
      const key = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = localizationHelper.translate(key);
      expect(translated).to.be.eq("LocalizedValue");
    });

    it("translates string containing multiple keys", () => {
      const text = "Front @namespace:firstKey@ and @namespace:secondKey@ End";
      i18nMock.setup((x) => x.translate("namespace:firstKey", moq.It.isAny())).returns(() => "FirstLocalizedValue");
      i18nMock.setup((x) => x.translate("namespace:secondKey", moq.It.isAny())).returns(() => "SecondLocalizedValue");
      const translated = localizationHelper.translate(text);
      expect(translated).to.be.eq("Front FirstLocalizedValue and SecondLocalizedValue End");
    });

  });

  describe("getLocalizedNodes", () => {

    it("translates labelDefinition", () => {
      const node = createRandomECInstancesNode();
      node.label.rawValue = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedNodes([node]);
      expect(node.label.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedContent", () => {

    it("translates contentItem labelDefinitions", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.label.rawValue = "@namespace:NotLocalized@";
      const content = new Content(createRandomDescriptor(), [contentItem]);
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.label.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedLabelDefinition", () => {

    it("translates labelDefinition", () => {
      const labelDefinition = createRandomLabelDefinition();
      labelDefinition.rawValue = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates labelDefinition with composite value", () => {
      const compositeValue = createRandomLabelCompositeValue();
      compositeValue.values.forEach((value) => {
        value.rawValue = "@namespace:NotLocalized@";
      });
      const labelDefinition: LabelDefinition = {
        displayValue: "Display",
        rawValue: compositeValue,
        typeName: "composite",
      };
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      compositeValue.values.forEach((value) => {
        expect(value.rawValue).to.be.eq("LocalizedValue");
      });

    });

    it("does not translate non string value", () => {
      const labelDefinition: LabelDefinition = {
        displayValue: "10",
        rawValue: 10,
        typeName: "int",
      };
      i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq(10);
      i18nMock.verify((x) => x.translate(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

  });

  describe("getLocalizedLabelDefinitions", () => {

    it("translates labelDefinitions", () => {
      const labelDefinitions = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      labelDefinitions.forEach((labelDefinition) => labelDefinition.rawValue = "@namespace:NotLocalized@");
      i18nMock.setup((x) => x.translate("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
      labelDefinitions.forEach((labelDefinition) => {
        expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
      });
    });

  });

});
