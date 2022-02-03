/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import type { ITwinLocalization } from "@itwin/core-i18n";
import { Content, Item, LabelDefinition } from "@itwin/presentation-common";
import {
  createRandomECInstancesNode, createRandomLabelCompositeValue, createRandomLabelDefinition, createTestContentDescriptor,
} from "@itwin/presentation-common/lib/cjs/test";
import { LocalizationHelper } from "../presentation-frontend/LocalizationHelper";
import { Presentation } from "../presentation-frontend/Presentation";

describe("LocalizationHelper", () => {
  const i18nMock = moq.Mock.ofType<ITwinLocalization>();
  let localizationHelper: LocalizationHelper;

  beforeEach(() => {
    i18nMock.reset();
    localizationHelper = new LocalizationHelper();
    Presentation.setLocalization(i18nMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("translate", () => {

    it("does not translate if key not found", () => {
      const key = "WrongKey";
      i18nMock.setup((x) => x.getLocalizedString("NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.getLocalizedString(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = localizationHelper.getLocalizedString(key);
      expect(translated).to.be.eq(key);
    });

    it("trims key", () => {
      const key = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      i18nMock.setup((x) => x.getLocalizedString(moq.It.isAny(), moq.It.isAny())).returns((origValue) => origValue);
      const translated = localizationHelper.getLocalizedString(key);
      expect(translated).to.be.eq("LocalizedValue");
    });

    it("translates string containing multiple keys", () => {
      const text = "Front @namespace:firstKey@ and @namespace:secondKey@ End";
      i18nMock.setup((x) => x.getLocalizedString("namespace:firstKey", moq.It.isAny())).returns(() => "FirstLocalizedValue");
      i18nMock.setup((x) => x.getLocalizedString("namespace:secondKey", moq.It.isAny())).returns(() => "SecondLocalizedValue");
      const translated = localizationHelper.getLocalizedString(text);
      expect(translated).to.be.eq("Front FirstLocalizedValue and SecondLocalizedValue End");
    });

  });

  describe("getLocalizedNodes", () => {

    it("translates labelDefinition", () => {
      const node = createRandomECInstancesNode();
      node.label.rawValue = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedNodes([node]);
      expect(node.label.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedContent", () => {

    it("translates contentItem labelDefinitions", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.label.rawValue = "@namespace:NotLocalized@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.label.rawValue).to.be.eq("LocalizedValue");
    });

  });

  describe("getLocalizedLabelDefinition", () => {

    it("translates labelDefinition", () => {
      const labelDefinition = createRandomLabelDefinition();
      labelDefinition.rawValue = "@namespace:NotLocalized@";
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
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
        typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME,
      };
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
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
      i18nMock.setup((x) => x.getLocalizedString(moq.It.isAny(), moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq(10);
      i18nMock.verify((x) => x.getLocalizedString(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

  });

  describe("getLocalizedLabelDefinitions", () => {

    it("translates labelDefinitions", () => {
      const labelDefinitions = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      labelDefinitions.forEach((labelDefinition) => labelDefinition.rawValue = "@namespace:NotLocalized@");
      i18nMock.setup((x) => x.getLocalizedString("namespace:NotLocalized", moq.It.isAny())).returns(() => "LocalizedValue");
      localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
      labelDefinitions.forEach((labelDefinition) => {
        expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
      });
    });

  });

});
