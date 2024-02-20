/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Ruleset, StandardNodeTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Hierarchy Grouping", () => {
    describe("PropertyGroup", () => {
      it("uses `createGroupForUnspecifiedValues` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.PropertyGroup.CreateGroupForUnspecifiedValues.Ruleset
        // The ruleset contains a root nodes rule for `bis.Element` instances and a grouping rule that groups them
        // by `UserLabel` property. By default all nodes whose instance doesn't have a value for the property would
        // be placed under a "Not Specified" grouping node, but the grouping rule has this behavior disabled through
        // the `createGroupForUnspecifiedValues` attribute.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                  groupByClass: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "Element" },
                  groups: [
                    {
                      specType: "Property",
                      propertyName: "UserLabel",
                      createGroupForUnspecifiedValues: false,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Confirm there's no "Not Specified" node
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.not.containSubset([
          {
            key: {
              type: StandardNodeTypes.ECPropertyGroupingNode,
              propertyName: "UserLabel",
              groupingValues: [null],
            },
          },
        ]);
      });

      it("uses `imageId` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.PropertyGroup.ImageId.Ruleset
        // The ruleset contains a root nodes rule for `bis.Element` instances and a grouping rule that groups them
        // by `UserLabel` property. The grouping rule also sets an image identifier for all grouping nodes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                  groupByClass: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "Element" },
                  groups: [
                    {
                      specType: "Property",
                      propertyName: "UserLabel",
                      imageId: "my-icon-identifier",
                      createGroupForSingleItem: true,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.PropertyGroup.ImageId.Result
        // Confirm that all grouping nodes got the `imageId`
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.not.be.empty;
        nodes.forEach((node) => {
          expect(node).to.containSubset({
            key: {
              type: StandardNodeTypes.ECPropertyGroupingNode,
              propertyName: "UserLabel",
            },
            imageId: "my-icon-identifier",
          });
        });
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `ranges` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.PropertyGroup.Ranges.Ruleset
        // The ruleset contains a root nodes rule for `bis.GeometricElement3d` and a grouping rule that groups them
        // by `Yaw` property into 3 ranges: "Negative", "Positive" and "Zero".
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
                  groupByClass: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "GeometricElement3d" },
                  groups: [
                    {
                      specType: "Property",
                      propertyName: "Yaw",
                      ranges: [
                        {
                          fromValue: "0",
                          toValue: "0",
                          label: "Zero",
                        },
                        {
                          fromValue: "-360",
                          toValue: "0",
                          label: "Negative",
                        },
                        {
                          fromValue: "0",
                          toValue: "360",
                          label: "Positive",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Confirm that elements were correctly grouped into ranges
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes)
          .to.have.lengthOf(2)
          .and.to.containSubset([
            {
              key: { type: StandardNodeTypes.ECPropertyGroupingNode, propertyName: "Yaw", groupedInstancesCount: 2 },
              label: { displayValue: "Negative" },
            },
            {
              key: { type: StandardNodeTypes.ECPropertyGroupingNode, propertyName: "Yaw", groupedInstancesCount: 60 },
              label: { displayValue: "Zero" },
            },
          ]);
      });
    });
  });
});
