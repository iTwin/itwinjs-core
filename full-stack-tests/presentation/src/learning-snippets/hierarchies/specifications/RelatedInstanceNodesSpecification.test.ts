/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";

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

  describe("Hierarchy Specifications", () => {

    describe("RelatedInstanceNodesSpecification", () => {

      it("uses `relationshipPaths` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.RelatedInstanceNodesSpecification.RelationshipPaths.Ruleset
        // The ruleset has a specification that returns `bis.PhysicalModel` root nodes. The child node specification
        // returns `bis.GeometricElement3d` instance nodes that are related to their model through `bis.ModelContainsElements`
        // relationship by following it in forward direction (from `bis.Model` to `bis.Element`).
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"] },
              groupByClass: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that correct Model Elements are returned, grouped by class
        const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(modelNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
        }]);

        const elementClassGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNodes[0].key });
        expect(elementClassGroupingNodes).to.have.lengthOf(2).and.to.containSubset([{
          label: { displayValue: "Physical Object" },
        }, {
          label: { displayValue: "TestClass" },
        }]);

        const elementNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: elementClassGroupingNodes[0].key });
        expect(elementNodes).to.have.lengthOf(2).and.to.containSubset([{
          key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
        }, {
          key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
        }]);
      });

    });

  });

});
