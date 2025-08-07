/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Presentation } from "@itwin/presentation-frontend";
import { collect } from "../../Utils.js";
import { describeContentTestSuite } from "./Utils.js";

describeContentTestSuite("Display labels", ({ getDefaultSuiteIModel }) => {
  it("returns display labels for given instances", async () => {
    const iter = await Presentation.presentation.getDisplayLabelDefinitionsIterator({
      imodel: await getDefaultSuiteIModel(),
      keys: [
        // we should be able to handle both `:` and `.` as schema/class name separator
        { className: "PCJ_TestSchema:TestClass", id: "0x70" },
        { className: "PCJ_TestSchema.TestClass", id: "0x71" },
      ],
    });
    expect(iter.total).to.eq(2);
    const labels = await collect(iter.items);
    expect(labels).to.deep.eq([
      {
        displayValue: "TestClass [0-34]",
        rawValue: "TestClass [0-34]",
        typeName: "string",
      },
      {
        displayValue: "TestClass [0-35]",
        rawValue: "TestClass [0-35]",
        typeName: "string",
      },
    ]);
  });
});
