/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Field, Item, LabelDefinition, RelationshipPath, SingleElementPropertiesRequestOptions, Value } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite, getFieldLabels } from "./Utils.js";
import { assert } from "@itwin/core-bentley";

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
              value: "Fàlsé",
            },
            ["True-False #2"]: {
              type: "primitive",
              value: "Trµé",
            },
            ["User Label"]: {
              type: "primitive",
              value: "TestClass",
            },
            ["Source Information"]: {
              items: {
                ["Model Source"]: {
                  items: {
                    ["Repository Link"]: {
                      type: "array",
                      valueType: "struct",
                      values: [
                        {
                          ["Name"]: {
                            type: "primitive",
                            value: "Properties_60InstancesWithUrl2.dgn",
                          },
                          ["Path"]: {
                            type: "primitive",
                            value: "file:///d|/temp/properties_60instanceswithurl2.dgn",
                          },
                        },
                      ],
                    },
                  },
                  type: "category",
                },
              },
              type: "category",
            },
          },
          type: "category",
        },
      },
    });
  });

  it("gets element properties with simple content parser", async () => {
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

  it("gets element properties with complex content parser", async () => {
    type ValueType =
      | Value
      | { from: { source: string; relationship: string; direction: "forward" | "backward"; target: string }[]; values: Record<string, ValueType>[] };
    const contentParser: SingleElementPropertiesRequestOptions<unknown, Record<string, ValueType>>["contentParser"] = (descriptor, item) => {
      const values: Record<string, ValueType> = {};
      function applyPrefix(fieldName: string, prefix?: string, index?: number) {
        return prefix ? `${prefix}${typeof index === "number" ? `[${index}]` : ""}.${fieldName}` : fieldName;
      }
      function visitFields(fields: Field[], currValues: Item["values"], valueNamePrefix?: string | undefined, valueIndex?: number) {
        for (const field of fields) {
          const fieldValue = currValues[field.name];
          if (field.isNestedContentField()) {
            assert(Value.isNestedContent(fieldValue));
            const prefix = applyPrefix(
              RelationshipPath.reverse(field.pathToPrimaryClass)
                .flatMap((step) => [`${step.isForwardRelationship ? "" : "!"}${step.relationshipInfo.name}`, step.targetClassInfo.name])
                .join("->"),
              valueNamePrefix,
              valueIndex,
            );
            fieldValue.forEach((nestedItem, nestedItemIndex) =>
              visitFields(field.nestedFields, nestedItem.values, prefix, fieldValue.length > 1 ? nestedItemIndex : undefined),
            );
          } else if (field.isPropertiesField()) {
            values[applyPrefix(field.properties[0].property.name, valueNamePrefix, valueIndex)] = Value.isNavigationValue(fieldValue)
              ? fieldValue.id
              : fieldValue;
          } else {
            values[applyPrefix(field.name, valueNamePrefix, valueIndex)] = fieldValue;
          }
        }
      }
      visitFields(descriptor.fields, item.values);
      return values;
    };

    const imodel = await getDefaultSuiteIModel();
    const result = await Presentation.presentation.getElementProperties({
      imodel,
      elementId: "0x61",
      contentParser,
    });
    expect(result).deep.eq({
      ["Model"]: "0x1c",
      ["UserLabel"]: "TestClass",
      ["Category"]: "0x17",
      ["CodeValue"]: undefined,
      ["Boolean_Property"]: false,
      ["Boolean_Property_2"]: true,
      ["String_Property_1"]: "Lithuania",
      ["String_Property_2"]: "Žydrūnas Ilgauskas",
      ["String_Property_3"]: "Star Wars - Return of the Jedi",
      ["String_Property_4"]: "Qui-gon Jinn",
      ["StringA"]: "°×Æò³",
      ["Integer_1"]: 55,
      ["Integer_2"]: 600,
      ["Integer_3"]: 1111111111,
      ["Integer_4"]: -2244,
      ["Decimal_1"]: 1e-7,
      ["Decimal_2"]: 99.01,
      ["Decimal_3"]: 1000000.001,
      ["PicklistColor"]: 4,
      ["!BisCore:ModelContainsElements->BisCore:Model->BisCore:ModelModelsElement->BisCore:ISubModeledElement->BisCore:ElementHasLinks->BisCore:RepositoryLink.Url"]: "file:///d|/temp/properties_60instanceswithurl2.dgn",
      ["!BisCore:ModelContainsElements->BisCore:Model->BisCore:ModelModelsElement->BisCore:ISubModeledElement->BisCore:ElementHasLinks->BisCore:RepositoryLink.UserLabel"]: "Properties_60InstancesWithUrl2.dgn",
    });
  });
});
