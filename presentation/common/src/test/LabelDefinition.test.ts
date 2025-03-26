/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LabelDefinition } from "../presentation-common/LabelDefinition.js";

describe("LabelDefinition", () => {
  describe("fromLabelString", () => {
    it("creates valid LabelDefinition from label string", () => {
      const definition = LabelDefinition.fromLabelString("test label");
      expect(definition).to.deep.eq({
        displayValue: "test label",
        rawValue: "test label",
        typeName: "string",
      });
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
