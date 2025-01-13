/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";
import { collect } from "../../../Utils";
import { TestIModelConnection } from "../../../IModelSetupUtils";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    imodel = TestIModelConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Hierarchy Rules", () => {
    describe("RootNodes & ChildNodes", () => {
      it("uses `ParentNode` symbol in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Condition.ParentNodeSymbol
        // This ruleset defines a tree with node "A" at the top and node "B" as child of "A".
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.Type = "A"`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect A root node with a B child
        const rootNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(rootNodes).to.containSubset([
          {
            label: { displayValue: "A" },
          },
        ]);

        const childNodes = await Presentation.presentation
          .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key })
          .then(async (x) => collect(x.items));
        expect(childNodes).to.containSubset([
          {
            label: { displayValue: "B" },
          },
        ]);
      });

      it("uses ruleset variables in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Condition.RulesetVariables.Ruleset
        // This ruleset defines two rules that can be enabled or disabled by setting variable DISPLAY_A_NODES and
        // DISPLAY_B_NODES values.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              condition: `GetVariableBoolValue("DISPLAY_A_NODES")`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "RootNodes",
              condition: `GetVariableBoolValue("DISPLAY_B_NODES")`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // No variables set - no nodes
        let nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes).to.be.empty;

        // Set DISPLAY_B_NODES to get node B
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_B_NODES", true);
        nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "B" },
            },
          ]);

        // Set DISPLAY_A_NODES to also get node A
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_A_NODES", true);
        nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(2)
          .and.to.containSubset([
            {
              label: { displayValue: "A" },
            },
            {
              label: { displayValue: "B" },
            },
          ]);
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.RequiredSchemas.Ruleset
        // The ruleset has one root node rule that returns `bis.ExternalSourceAspect` instances. The
        // ECClass was introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["ExternalSourceAspect"],
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - no nodes should be returned
        const { total } = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset });
        expect(total).to.eq(0);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Priority.Ruleset
        // The ruleset has two root node rules that return nodes "A" and "B" respectively. The rules
        // have different priorities and higher priority rule is handled first - it's node appears first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              priority: 1,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "RootNodes",
              priority: 2,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify B comes before A
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes).to.be.lengthOf(2);
        expect(nodes[0]).containSubset({
          label: { displayValue: "B" },
        });
        expect(nodes[1]).containSubset({
          label: { displayValue: "A" },
        });
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.OnlyIfNotHandled.Ruleset
        // The ruleset has two root node rules that return nodes "A" and "B" respectively. The "A" rule has
        // lower priority and `onlyIfNotHandled` attribute, which allows it to be overriden by higher priority rules.
        // The "B" rule does exactly that.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              priority: 1,
              onlyIfNotHandled: true,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "RootNodes",
              priority: 2,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect only "B" node, as the rule for "A" is skipped due to `onlyIfNotHandled` attribute
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "B" },
            },
          ]);
      });

      it("uses `customizationRules` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomizationRules.Ruleset
        // The ruleset has a global label override rule and two root node rules that return nodes "A" and "B"
        // respectively. The "B" rule has a label override of its own.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              // This label override applies to all nodes in the hierarchy
              ruleType: "LabelOverride",
              label: `"Global: " & ThisNode.Label`,
            },
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
              customizationRules: [
                {
                  // This label override applies only to nodes created at its scope and takes
                  // precedence over the global rule
                  ruleType: "LabelOverride",
                  label: `"Nested: " & ThisNode.Label`,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect global label override to be applied on "A" and nested label override to be applied on "B"
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(2)
          .and.to.containSubset([
            {
              label: { displayValue: "Global: A" },
            },
            {
              label: { displayValue: "Nested: B" },
            },
          ]);
      });

      it("uses `subConditions` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.SubConditions.Ruleset
        // The ruleset has a root node rule with a schemas requirement and 2 sub-conditions. The latter are only used if schemas
        // requirement is met. Each sub-condition can have additional conditions.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              // the schemas requirement gets applied to both sub-conditions
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.1" }],
              subConditions: [
                {
                  condition: `TRUE`,
                  specifications: [
                    {
                      specType: "CustomNode",
                      type: "A",
                      label: "A",
                    },
                  ],
                },
                {
                  condition: `FALSE`,
                  specifications: [
                    {
                      specType: "CustomNode",
                      type: "B",
                      label: "B",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The root node rule meets schema requirement, but only the first sub-condition's condition
        // attribute evaluates to `true` - expect only the "A" node.
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "A" },
            },
          ]);
      });

      it("uses `autoExpand` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.AutoExpand.Ruleset
        // The ruleset defines a root node "A" which should be automatically expanded. The flag is only
        // set if the node actually has children.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              autoExpand: true,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "A",
                  label: "A",
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.Type = "A"`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "B",
                  label: "B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The root node is expected to have `isExpanded = true`
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "A" },
              isExpanded: true,
            },
          ]);
      });
    });
  });
});
