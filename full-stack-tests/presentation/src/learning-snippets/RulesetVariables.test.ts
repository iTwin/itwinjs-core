/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests.js";
import { printRuleset } from "./Utils.js";
import { collect } from "../Utils.js";
import { TestIModelConnection } from "../IModelSetupUtils.js";

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

  describe("Ruleset Variables", () => {
    it("uses ruleset variable in rule condition", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InRuleCondition.Ruleset
      // The ruleset has two content rules - one for models and one for elements. The one actually used
      // depends on the value of `CONTENT_TYPE` ruleset variable, which can be changed without modifying the ruleset itself.
      const ruleset: Ruleset = {
        id: "test",
        rules: [
          {
            ruleType: "Content",
            condition: `GetVariableStringValue("CONTENT_TYPE") = "models"`,
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
              },
            ],
          },
          {
            ruleType: "Content",
            condition: `GetVariableStringValue("CONTENT_TYPE") = "elements"`,
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // No variable set - the request should return no content
      const contentNoVariable = await Presentation.presentation.getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} });
      expect(contentNoVariable).to.be.undefined;

      // Set variable to "models" and ensure we get model items
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InRuleCondition.SetToModels
      await Presentation.presentation.vars(ruleset.id).setString("CONTENT_TYPE", "models");
      // __PUBLISH_EXTRACT_END__
      const modelItems = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(modelItems).to.have.lengthOf(8);
      modelItems.forEach((item) =>
        expect(item.classInfo!.name).to.be.oneOf([
          "BisCore:LinkModel",
          "BisCore:DictionaryModel",
          "Generic:GroupModel",
          "BisCore:DocumentListModel",
          "BisCore:DefinitionModel",
          "BisCore:PhysicalModel",
          "BisCore:RepositoryModel",
        ]),
      );

      // Set variable to "elements" and ensure we get element items
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InRuleCondition.SetToElements
      await Presentation.presentation.vars(ruleset.id).setString("CONTENT_TYPE", "elements");
      // __PUBLISH_EXTRACT_END__
      const elementItems = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(elementItems).to.have.lengthOf(104);
    });

    it("uses ruleset variable in instance filter", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InInstanceFilter.Ruleset
      // The ruleset has a content node rule which loads all `bis.Element` instances, optionally filtered
      // by ECInstanceId. The filter is controlled through `ELEMENT_IDS` ruleset variable.
      const ruleset: Ruleset = {
        id: "test",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                instanceFilter: `NOT HasVariable("ELEMENT_IDS") OR GetVariableIntValues("ELEMENT_IDS").AnyMatch(id => id = this.ECInstanceId)`,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // No variable set - the request should return content for all elements
      let items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.have.lengthOf(104);

      // Set the value to several element IDs and ensure we get their content
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InInstanceFilter.SetIds
      await Presentation.presentation.vars(ruleset.id).setId64s("ELEMENT_IDS", ["0x1", "0x74", "0x40"]);
      // __PUBLISH_EXTRACT_END__
      items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.containSubset([
        {
          primaryKeys: [{ id: "0x1" }],
        },
        {
          primaryKeys: [{ id: "0x74" }],
        },
        {
          primaryKeys: [{ id: "0x40" }],
        },
      ]);

      // Set the value to different element IDs and ensure we get their content
      await Presentation.presentation.vars(ruleset.id).setId64s("ELEMENT_IDS", ["0x17", "0x16"]);
      items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.containSubset([
        {
          primaryKeys: [{ id: "0x17" }],
        },
        {
          primaryKeys: [{ id: "0x16" }],
        },
      ]);

      // Finally, unsetting the value should get us the initial view
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InInstanceFilter.Unset
      await Presentation.presentation.vars(ruleset.id).unset("ELEMENT_IDS");
      // __PUBLISH_EXTRACT_END__
      items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.have.lengthOf(104);
    });

    it("uses ruleset variable in customization rule value expression", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InCustomizationRuleValueExpression.Ruleset
      // The ruleset has a content rule which loads all `bis.SpatialViewDefinition` instances. There's
      // also an extended data customization rule which assigns the ruleset variable value to each content item. The value
      // can be used to, for example, display a prefix in front of the label. The prefix is controlled through the `PREFIX` ruleset variable.
      const ruleset: Ruleset = {
        id: "test",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"], arePolymorphic: true },
              },
            ],
          },
          {
            ruleType: "ExtendedData",
            condition: `this.IsOfClass("SpatialViewDefinition", "BisCore")`,
            items: {
              labelPrefix: `IIF(HasVariable("PREFIX"), GetVariableStringValue("PREFIX"), "")`,
            },
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // No variable set - the request should return nodes without any prefix
      let items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.containSubset([
        {
          extendedData: { labelPrefix: "" },
        },
        {
          extendedData: { labelPrefix: "" },
        },
        {
          extendedData: { labelPrefix: "" },
        },
        {
          extendedData: { labelPrefix: "" },
        },
      ]);

      // Set the prefix to some value and confirm the prefix is set
      // __PUBLISH_EXTRACT_START__ Presentation.RulesetVariables.InCustomizationRuleValueExpression.SetValue
      await Presentation.presentation.vars(ruleset.id).setString("PREFIX", "test");
      // __PUBLISH_EXTRACT_END__
      items = await Presentation.presentation
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys: new KeySet(), descriptor: {} })
        .then(async (x) => collect(x!.items));
      expect(items).to.containSubset([
        {
          extendedData: { labelPrefix: "test" },
        },
        {
          extendedData: { labelPrefix: "test" },
        },
        {
          extendedData: { labelPrefix: "test" },
        },
        {
          extendedData: { labelPrefix: "test" },
        },
      ]);
    });
  });
});
