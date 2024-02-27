/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { printRuleset } from "../Utils";

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

  describe("RepeatableRelationshipPathSpecification", () => {
    it("using single-step specification with `count`", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RepeatableRelationshipPathSpecification.SingleStepWithCount.Ruleset
      // This ruleset defines a specification that returns content for given `bis.Element` instances by
      // returning their grandparent property values.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  {
                    relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                    direction: "Backward",
                    count: 2,
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that content of grandparent element is returned
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:Element", id: "0x1b" }]),
        descriptor: {},
      });
      expect(content!.contentSet)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            primaryKeys: [{ id: "0x1" }],
          },
        ]);
    });

    it("using recursive specification", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RepeatableRelationshipPathSpecification.RecursiveSingleStep.Ruleset
      // This ruleset defines a specification that returns content for all children of the given `bis.Element`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  {
                    relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                    direction: "Forward",
                    count: "*",
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that content of the root subject's children is returned
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:Element", id: "0x1" }]),
        descriptor: {},
      });
      expect(content!.contentSet)
        .to.have.lengthOf(9)
        .and.to.containSubset([
          {
            primaryKeys: [{ id: "0xe" }],
          },
          {
            primaryKeys: [{ id: "0x10" }],
          },
          {
            primaryKeys: [{ id: "0x12" }],
          },
          {
            primaryKeys: [{ id: "0x13" }],
          },
          {
            primaryKeys: [{ id: "0x14" }],
          },
          {
            primaryKeys: [{ id: "0x15" }],
          },
          {
            primaryKeys: [{ id: "0x16" }],
          },
          {
            primaryKeys: [{ id: "0x1b" }],
          },
          {
            primaryKeys: [{ id: "0x1c" }],
          },
        ]);
    });

    it("combining recursive and non-recursive specifications", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RepeatableRelationshipPathSpecification.RecursiveAndNonRecursiveSpecificationsCombination.Ruleset
      // This ruleset defines a specification that returns content for categories of all elements in
      // the given `bis.Model` and their children.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                      count: "*",
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                      direction: "Forward",
                    },
                  ],
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that elements' category is returned when requesting content for those elements' model
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(content!.contentSet)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            primaryKeys: [{ id: "0x17" }],
          },
        ]);
    });

    it("combining multiple recursive specifications", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RepeatableRelationshipPathSpecification.MultipleRecursiveSpecificationsCombination.Ruleset
      // The ruleset contains a three-step relationship path that finds all `bis.GeometricElement3d` elements related to given model
      // through the `bis.ModelContainsElements` relationship, then finds all `bis.SpatialCategory` elements related to `bis.GeometricElement3d`
      // found in the previous step through `bis.GeometricElement3dIsInCategory` relationship and finds all `bis.SubCategory` elements related
      // to `bis.SpatialCategory` found in the previous step through `bis.CategoryOwnsSubCategories` relationship.
      // The result includes `bis.GeometricElement3d`, `bis.SpatialCategory` and `bis.SubCategory` elements.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                      count: "*",
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "SpatialCategory" },
                      count: "*",
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "CategoryOwnsSubCategories" },
                      direction: "Forward",
                      count: "*",
                    },
                  ],
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that the count is correct (62 elements + 1 category + 1 sub-category) and both
      // categories are included. Not checking the elements...
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(content!.contentSet).to.have.lengthOf(62 + 1 + 1);
      expect(content!.contentSet).to.containSubset([
        {
          primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
        },
      ]);
      expect(content!.contentSet).to.containSubset([
        {
          primaryKeys: [{ className: "BisCore:SubCategory", id: "0x18" }],
        },
      ]);
    });
  });
});
