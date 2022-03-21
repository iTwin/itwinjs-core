/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, InstanceLabelOverrideValueSpecificationType, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { printRuleset } from "../Utils";

describe("Learning Snippets", () => {

  let imodel: IModelConnection;

  beforeEach(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  afterEach(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Customization Rules", () => {

    describe("Sorting", () => {

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Sorting.RequiredSchemas.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there is a customization rule to sort
        // instances by `Pitch` property. Sorting rule requires `BisCore` schema to be higher than 1.0.2.
        // If this requirement is not met sorting rule does not take effect.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

    });

  });

});
