/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LabelDefinition } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite, getFieldLabels } from "./Utils";

describeContentTestSuite("Element properties", ({ getDefaultSuiteIModel }) => {
  it("gets element properties with default content parser", async () => {
    const imodel = await getDefaultSuiteIModel();
    const result = await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x61",
    });
    expect(result).deep.eq({
      class: "TestClass",
      id: "0x61",
      label: "TestClass [0-2P]",
      items: {
        "$élêçtèd Ítêm(s)": {
          items: {
            ["Category"]: {
              type: "primitive",
              value: "Uncategorized",
            },
            ["Code"]: {
              type: "primitive",
              value: "",
            },
            ["Color"]: {
              type: "primitive",
              value: "Purple",
            },
            ["Decimal Properties"]: {
              items: {
                ["<0"]: {
                  type: "primitive",
                  value: "0.00",
                },
                ["<100"]: {
                  type: "primitive",
                  value: "99.01",
                },
                ["<Infinity"]: {
                  type: "primitive",
                  value: "1000000.00",
                },
              },
              type: "category",
            },
            ["Integer Properties"]: {
              items: {
                ["0-100"]: {
                  type: "primitive",
                  value: "55",
                },
                ["0-1000"]: {
                  type: "primitive",
                  value: "600",
                },
                ["0-Infinity"]: {
                  type: "primitive",
                  value: "1111111111",
                },
                ["Negative Numbers"]: {
                  type: "primitive",
                  value: "-2244",
                },
              },
              type: "category",
            },
            ["Model"]: {
              type: "primitive",
              value: "Properties_60InstancesWithUrl2",
            },
            ["String Properties"]: {
              items: {
                ["Country"]: {
                  type: "primitive",
                  value: "Lithuania",
                },
                ["Movies"]: {
                  type: "primitive",
                  value: "Star Wars - Return of the Jedi",
                },
                ["Special Characters"]: {
                  type: "primitive",
                  value: "°×Æò³",
                },
                ["Sports Stars"]: {
                  type: "primitive",
                  value: "Žydrūnas Ilgauskas",
                },
                ["Star Wars"]: {
                  type: "primitive",
                  value: "Qui-gon Jinn",
                },
              },
              type: "category",
            },
            ["True-False"]: {
              type: "primitive",
              value: "False",
            },
            ["True-False #2"]: {
              type: "primitive",
              value: "True",
            },
            ["User Label"]: {
              type: "primitive",
              value: "TestClass",
            },
          },
          type: "category",
        },
      },
    });
  });

  it("gets element properties with custom content parser", async () => {
    const imodel = await getDefaultSuiteIModel();
    const result = await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x61",
      contentParser: (descriptor, item) => ({
        fieldsCount: getFieldLabels(descriptor.fields).length,
        label: item.label,
      }),
    });
    expect(result).deep.eq({
      fieldsCount: 20,
      label: LabelDefinition.fromLabelString("TestClass [0-2P]"),
    });
  });
});
