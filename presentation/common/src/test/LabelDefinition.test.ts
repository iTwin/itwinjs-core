/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import { LabelCompositeValue, LabelDefinition } from "../presentation-common/LabelDefinition";
import { createRandomLabelCompositeValue, createRandomLabelDefinition } from "./_helpers/random";

/* eslint-disable deprecation/deprecation */

const createRandomCompositeLabelDefinition = (): LabelDefinition => {
  return { displayValue: faker.random.word(), rawValue: createRandomLabelCompositeValue(), typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME };
};

describe("LabelDefinition", () => {
  describe("toJSON", () => {
    it("serializes LabelDefinition", () => {
      const definition = createRandomLabelDefinition();
      const json = LabelDefinition.toJSON(definition);
      expect(json).to.matchSnapshot();
    });

    it("serializes LabelDefinition with composite value", () => {
      const definition = createRandomCompositeLabelDefinition();
      const json = LabelDefinition.toJSON(definition);
      expect(json).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("creates valid LabelDefinition from JSON", () => {
      const json = createRandomLabelDefinition();
      const definition = LabelDefinition.fromJSON(json);
      expect(definition).to.matchSnapshot();
    });

    it("creates valid LabelDefinition from serialized JSON", () => {
      const json = createRandomLabelDefinition();
      const definition = LabelDefinition.fromJSON(JSON.stringify(json));
      expect(definition).to.matchSnapshot();
    });

    it("creates valid LabelDefinition with composite value from JSON", () => {
      const json = createRandomCompositeLabelDefinition();
      const definition = LabelDefinition.fromJSON(json);
      expect(definition).to.matchSnapshot();
    });

    it("creates valid LabelDefinition with composite value from serialized JSON", () => {
      const json = createRandomCompositeLabelDefinition();
      const definition = LabelDefinition.fromJSON(JSON.stringify(json));
      expect(definition).to.matchSnapshot();
    });
  });

  describe("fromLabelString", () => {
    it("creates valid LabelDefinition from label string", () => {
      const label = faker.random.word();
      const definition = LabelDefinition.fromLabelString(label);
      expect(definition).to.matchSnapshot();
    });
  });

  describe("isCompositeDefinition", () => {
    it("returns correct values", () => {
      const stringDefinition = LabelDefinition.fromLabelString("Test String");
      const compositeDefinition: LabelDefinition = {
        typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME,
        displayValue: "Composite-Value",
        rawValue: {
          separator: "-",
          values: [LabelDefinition.fromLabelString("Composite"), LabelDefinition.fromLabelString("Value")],
        },
      };
      expect(LabelDefinition.isCompositeDefinition(stringDefinition)).to.be.false;
      expect(LabelDefinition.isCompositeDefinition(compositeDefinition)).to.be.true;
    });
  });
});

describe("LabelCompositeValue", () => {
  describe("toJSON", () => {
    it("serializes LabelCompositeValue", () => {
      const compositeValue = createRandomLabelCompositeValue();
      const json = LabelCompositeValue.toJSON(compositeValue);
      expect(json).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("creates valid LabelCompositeValue from JSON", () => {
      const json = createRandomLabelCompositeValue();
      const compositeValue = LabelCompositeValue.fromJSON(json);
      expect(compositeValue).to.matchSnapshot();
    });
  });
});
