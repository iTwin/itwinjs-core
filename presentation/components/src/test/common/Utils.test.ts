/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import * as React from "react";
import * as moq from "typemoq";
import { I18N } from "@bentley/imodeljs-i18n";
import { applyOptionalPrefix, LabelCompositeValue, LabelDefinition } from "@bentley/presentation-common";
import {
  createRandomDescriptor, createRandomLabelCompositeValue, createRandomLabelDefinition, createRandomNestedContentField, createRandomPropertiesField,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Presentation } from "@bentley/presentation-frontend";
import { Primitives, PrimitiveValue } from "@bentley/ui-abstract";
import * as utils from "../../presentation-components/common/Utils";

class TestComponent extends React.Component {
}

describe("Utils", () => {

  describe("getDisplayName", () => {

    beforeEach(() => {
      (TestComponent as any).displayName = undefined;
      Object.defineProperty(TestComponent, "name", { value: undefined });
    });

    it("returns displayName property value, if set", () => {
      const displayName = faker.random.word();
      (TestComponent as any).displayName = displayName;
      expect(utils.getDisplayName(TestComponent)).to.eq(displayName);
    });

    it("returns name property value, if set", () => {
      const displayName = faker.random.word();
      Object.defineProperty(TestComponent, "name", { value: displayName });
      expect(utils.getDisplayName(TestComponent)).to.eq(displayName);
    });

    it("returns 'Component' if neither displayName nor name properties are set", () => {
      expect(utils.getDisplayName(TestComponent)).to.eq("Component");
    });

  });

  describe("findField", () => {

    it("returns undefined for invalid name", () => {
      const descriptor = createRandomDescriptor();
      const result = utils.findField(descriptor, "doesn't exist");
      expect(result).to.be.undefined;
    });

    it("returns undefined for invalid name when there are nested fields", () => {
      const nestedField = createRandomPropertiesField();
      const nestingField = createRandomNestedContentField([nestedField]);
      const descriptor = createRandomDescriptor(undefined, [nestingField]);
      const result = utils.findField(descriptor, applyOptionalPrefix(nestedField.name, "doesn't exist"));
      expect(result).to.be.undefined;
    });

    it("finds field in Descriptor.fields list", () => {
      const descriptor = createRandomDescriptor();
      const field = descriptor.fields[0];
      const result = utils.findField(descriptor, field.name);
      expect(result).to.eq(field);
    });

    it("finds nested field", () => {
      const nestedField = createRandomPropertiesField();
      const nestingField = createRandomNestedContentField([nestedField]);
      const descriptor = createRandomDescriptor(undefined, [nestingField]);
      const result = utils.findField(descriptor, applyOptionalPrefix(nestedField.name, nestingField.name));
      expect(result!.name).to.eq(nestedField.name);
    });

  });

  describe("initializeLocalization", () => {
    const i18nMock = moq.Mock.ofType<I18N>();

    beforeEach(() => {
      i18nMock.setup((x) => x.registerNamespace(moq.It.isAny())).returns(() => ({ name: "namespace", readFinished: Promise.resolve() }));
      Presentation.setI18nManager(i18nMock.object);
    });

    afterEach(() => {
      Presentation.terminate();
    });

    it("registers and unregisters namespace", async () => {
      const terminate = await utils.initializeLocalization();
      i18nMock.verify((x) => x.registerNamespace(moq.It.isAny()), moq.Times.once());
      terminate();
      i18nMock.verify((x) => x.unregisterNamespace(moq.It.isAny()), moq.Times.once());
    });

  });

  describe("createLabelRecord", () => {
    const validateCompositeValue = (actual: Primitives.Composite, expected: LabelCompositeValue) => {
      expect(actual.separator).to.be.eq(expected.separator);
      expect(actual.parts.length).to.be.eq(expected.values.length);
      for (let i = 0; i < actual.parts.length; i++) {
        expect(actual.parts[i].displayValue).to.be.eq(expected.values[i].displayValue);
        expect(actual.parts[i].rawValue).to.be.eq(expected.values[i].rawValue);
        expect(actual.parts[i].typeName).to.be.eq(expected.values[i].typeName);
      }
    };

    it("creates PropertyRecord for label with simple value", () => {
      const definition = createRandomLabelDefinition();
      const record = utils.createLabelRecord(definition, "test");
      const primitiveValue = record.value as PrimitiveValue;
      expect(primitiveValue.value).to.be.eq(definition.rawValue);
      expect(primitiveValue.displayValue).to.be.eq(definition.displayValue);
      expect(record.property.typename).to.be.eq(definition.typeName);
    });

    it("creates PropertyRecord for label with composite value", () => {
      const compositeValue = createRandomLabelCompositeValue();
      const definition = { ...createRandomLabelDefinition(), rawValue: compositeValue, typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME };
      const record = utils.createLabelRecord(definition, "test");
      const primitiveValue = record.value as PrimitiveValue;
      validateCompositeValue(primitiveValue.value as Primitives.Composite, definition.rawValue);
      expect(primitiveValue.displayValue).to.be.eq(definition.displayValue);
      expect(record.property.typename).to.be.eq(definition.typeName);
    });

  });

});
