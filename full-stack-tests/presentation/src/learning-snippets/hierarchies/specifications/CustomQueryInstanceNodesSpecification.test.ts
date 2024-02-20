/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
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

  describe("Hierarchy Specifications", () => {
    describe("CustomQueryInstanceNodesSpecification", () => {
      it("uses `queries` attribute with StringQuerySpecification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomQueryInstanceNodesSpecification.StringQuerySpecification.Ruleset
        // The ruleset has a root nodes' specification that uses a given query to get all `bis.Model` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomQueryInstanceNodes",
                  queries: [
                    {
                      specType: "String",
                      class: { schemaName: "BisCore", className: "Model" },
                      query: `SELECT * FROM bis.Model`,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that Model nodes are returned
        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes)
          .to.have.lengthOf(7)
          .and.to.containSubset([
            {
              label: { displayValue: "Definition Model" },
            },
            {
              label: { displayValue: "Dictionary Model" },
            },
            {
              label: { displayValue: "Document List" },
            },
            {
              label: { displayValue: "Group Model" },
            },
            {
              label: { displayValue: "Link Model" },
            },
            {
              label: { displayValue: "Physical Model" },
            },
            {
              label: { displayValue: "Repository Model" },
            },
          ]);

        const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[5].key });
        expect(modelNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "Properties_60InstancesWithUrl2" },
            },
          ]);
      });

      it("uses `queries` attribute with ECPropertyValueQuerySpecification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomQueryInstanceNodesSpecification.ECPropertyValueQuerySpecification.Ruleset
        // The ruleset has a root nodes' specification that returns `MyDomain.MyParentElement` nodes. It also has
        // a children specification that returns `MyDomain.MyChildElement` children for `MyDomain.MyParentElement`
        // parent nodes using `ChildrenQuery` property value of the parent element.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "MyDomain", classNames: ["MyParentElement"], arePolymorphic: true },
                  groupByClass: false,
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.IsOfClass("MyParentElement", "MyDomain")`,
              specifications: [
                {
                  specType: "CustomQueryInstanceNodes",
                  queries: [
                    {
                      specType: "ECPropertyValue",
                      class: { schemaName: "MyDomain", className: "MyChildElement" },
                      parentPropertyName: "ChildrenQuery",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // our test iModel doesn't have any elements with ECSQL queries as their property values, so
        // we can't construct any ruleset that would actually return nodes for this test case
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.be.empty;
      });
    });
  });
});
