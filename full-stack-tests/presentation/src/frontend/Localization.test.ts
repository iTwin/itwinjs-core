/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelApp, IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, DefaultContentDisplayTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, terminate, testLocalization } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";

describe("Localization", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize({ localization: testLocalization });
    await IModelApp.localization.registerNamespace("Test");
    Presentation.presentation.activeLocale = "test";
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("localizes nodes", async () => {
    const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: CUSTOM_NODES_RULESET });
    expect(nodes.length).to.eq(1);
    expect(nodes[0].label.displayValue).to.eq("_test_ string");
    expect(nodes[0].description).to.eq("_test_ nested string");
  });

  it("localizes nodes when requesting with count", async () => {
    const { nodes } = await Presentation.presentation.getNodesAndCount({ imodel, rulesetOrId: CUSTOM_NODES_RULESET });
    expect(nodes.length).to.eq(1);
    expect(nodes[0].label.displayValue).to.eq("_test_ string");
    expect(nodes[0].description).to.eq("_test_ nested string");
  });

  it("localizes nodes descriptor", async () => {
    const descriptor = await Presentation.presentation.getNodesDescriptor({
      imodel,
      rulesetOrId: {
        id: "nodes descriptor",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
              },
            ],
          },
        ],
      },
    });
    expect(descriptor!.categories[0].label).to.eq("Selected Item(s)");
  });

  it("localizes node paths", async () => {
    const paths = await Presentation.presentation.getNodePaths({
      imodel,
      rulesetOrId: {
        id: "nodes descriptor",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
          {
            ruleType: "InstanceLabelOverride",
            class: { schemaName: "BisCore", className: "Subject" },
            values: [
              {
                specType: "String",
                value: "@Test:string@",
              },
            ],
          },
        ],
      },
      instancePaths: [[{ className: "BisCore:Subject", id: "0x1" }]],
    });
    expect(paths[0].node.label.displayValue).to.eq("_test_ string");
  });

  it("localizes filtered node paths", async () => {
    const paths = await Presentation.presentation.getFilteredNodePaths({
      imodel,
      rulesetOrId: {
        id: "nodes descriptor",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
          {
            ruleType: "InstanceLabelOverride",
            class: { schemaName: "BisCore", className: "Subject" },
            values: [
              {
                specType: "String",
                value: "@Test:string@",
              },
            ],
          },
        ],
      },
      filterText: "str",
    });
    expect(paths[0].node.label.displayValue).to.eq("_test_ string");
  });

  it("localizes content descriptor", async () => {
    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: {
        id: "content descriptor",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
              },
            ],
          },
          {
            ruleType: "DefaultPropertyCategoryOverride",
            specification: {
              id: "default",
              label: "@Test:string@",
              description: "@Test:nested.string@",
            },
          },
        ],
      },
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    expect(descriptor!.categories[0].label).to.eq("_test_ string");
    expect(descriptor!.categories[0].description).to.eq("_test_ nested string");
  });

  it("localizes content", async () => {
    const content = await Presentation.presentation.getContent({
      imodel,
      rulesetOrId: {
        id: "content",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
                calculatedProperties: [
                  {
                    label: "@Test:string@",
                    value: `"@Test:nested.string@"`,
                  },
                ],
              },
            ],
          },
          {
            ruleType: "DefaultPropertyCategoryOverride",
            specification: {
              id: "default",
              label: "@Test:string@",
              description: "@Test:nested.string@",
            },
          },
        ],
      },
      descriptor: {
        displayType: DefaultContentDisplayTypes.PropertyPane,
      },
      keys: new KeySet(),
    });

    expect(content!.descriptor.categories[0].label).to.eq("_test_ string");
    expect(content!.descriptor.categories[0].description).to.eq("_test_ nested string");

    const field = getFieldByLabel(content!.descriptor.fields, "_test_ string");
    expect(content!.contentSet[0].displayValues[field.name]).to.eq("_test_ nested string");
  });

  it("localizes content when requesting with size", async () => {
    const { content } = (await Presentation.presentation.getContentAndSize({
      imodel,
      rulesetOrId: {
        id: "content",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
                calculatedProperties: [
                  {
                    label: "@Test:string@",
                    value: `"@Test:nested.string@"`,
                  },
                ],
              },
            ],
          },
          {
            ruleType: "DefaultPropertyCategoryOverride",
            specification: {
              id: "default",
              label: "@Test:string@",
              description: "@Test:nested.string@",
            },
          },
        ],
      },
      descriptor: {
        displayType: DefaultContentDisplayTypes.PropertyPane,
      },
      keys: new KeySet(),
    }))!;

    expect(content.descriptor.categories[0].label).to.eq("_test_ string");
    expect(content.descriptor.categories[0].description).to.eq("_test_ nested string");

    const field = getFieldByLabel(content.descriptor.fields, "_test_ string");
    expect(content.contentSet[0].displayValues[field.name]).to.eq("_test_ nested string");
  });

  it("localizes distinct values", async () => {
    const ruleset: Ruleset = {
      id: "content",
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "ContentInstancesOfSpecificClasses",
              classes: { schemaName: "BisCore", classNames: ["Subject"] },
              calculatedProperties: [
                {
                  label: "@Test:string@",
                  value: `"@Test:nested.string@"`,
                },
              ],
            },
          ],
        },
      ],
    };
    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: ruleset,
      displayType: DefaultContentDisplayTypes.Grid,
      keys: new KeySet(),
    });
    const field = getFieldByLabel(descriptor!.fields, "_test_ string");
    const distinctValues = await Presentation.presentation.getPagedDistinctValues({
      imodel,
      rulesetOrId: ruleset,
      descriptor: descriptor!,
      keys: new KeySet(),
      fieldDescriptor: field.getFieldDescriptor(),
    });
    expect(distinctValues.items[0].displayValue).to.eq("_test_ nested string");
  });

  describe("Multiple frontends for one backend", async () => {
    let frontends: PresentationManager[];

    beforeEach(async () => {
      frontends = ["en", "test"].map((locale) => PresentationManager.create({ activeLocale: locale }));
    });

    afterEach(async () => {
      frontends.forEach((f) => f.dispose());
    });

    it("handles multiple simultaneous requests from different frontends with different locales", async () => {
      await Promise.all(
        Array.from({ length: 100 }).map(async () => {
          const [en, test] = await Promise.all([
            await frontends[0].getNodes({ imodel, rulesetOrId: CUSTOM_NODES_RULESET }),
            await frontends[1].getNodes({ imodel, rulesetOrId: CUSTOM_NODES_RULESET }),
          ]);

          expect(en[0].label.displayValue).to.eq("test value");
          expect(en[0].description).to.eq("test nested value");

          expect(test[0].label.displayValue).to.eq("_test_ string");
          expect(test[0].description).to.eq("_test_ nested string");
        }),
      );
    });
  });
});

const CUSTOM_NODES_RULESET: Ruleset = {
  id: "localization test",
  rules: [
    {
      ruleType: RuleTypes.RootNodes,
      specifications: [
        {
          specType: ChildNodeSpecificationTypes.CustomNode,
          type: "root",
          label: "@Test:string@",
          description: "@Test:nested.string@",
        },
      ],
    },
  ],
};
