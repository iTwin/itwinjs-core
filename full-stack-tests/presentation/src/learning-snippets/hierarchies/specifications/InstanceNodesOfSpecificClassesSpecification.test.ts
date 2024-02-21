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
    describe("InstanceNodesOfSpecificClassesSpecification", () => {
      it("uses `classes` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.InstanceNodesOfSpecificClassesSpecification.Classes.Ruleset
        // The ruleset has a specification that returns nodes for instances of `bis.PhysicalModel` class and all
        // its subclasses.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that PhysicalModel nodes were returned, grouped by class
        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "Physical Model" },
            },
          ]);

        const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
        expect(instanceNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "Properties_60InstancesWithUrl2" },
            },
          ]);
      });

      it("uses `excludedClasses` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.InstanceNodesOfSpecificClassesSpecification.ExcludedClasses.Ruleset
        // The ruleset has a specification that returns nodes for all instances of `bis.Model` class
        // excluding instances of `bis.DefinitionModel`, `bis.GroupInformationModel` and their subclasses.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                  excludedClasses: { schemaName: "BisCore", classNames: ["DefinitionModel", "GroupInformationModel"], arePolymorphic: true },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that DefinitionModel and GroupInformationModel nodes are not included
        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes)
          .to.have.lengthOf(3)
          .and.to.containSubset([
            {
              label: { displayValue: "Document List" },
            },
            {
              label: { displayValue: "Link Model" },
            },
            {
              label: { displayValue: "Physical Model" },
            },
          ]);
      });

      it("uses `instanceFilter` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.InstanceNodesOfSpecificClassesSpecification.InstanceFilter.Ruleset
        // The ruleset has a specification that returns nodes for `bis.ViewDefinition` instances whose
        // `CodeValue` property value ends with "View 1".
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                  instanceFilter: `this.CodeValue ~ "%View 1"`,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that ViewDefinition nodes ending with "View 1" are not included
        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "Spatial View Definition" },
            },
          ]);

        const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
        expect(instanceNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "Default - View 1" },
            },
          ]);
      });
    });
  });
});
