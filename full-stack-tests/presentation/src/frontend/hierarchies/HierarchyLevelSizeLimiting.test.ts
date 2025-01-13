/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes,
  GroupingSpecificationTypes,
  InstanceKey,
  PresentationError,
  RelationshipDirection,
  Ruleset,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { buildTestIModelConnection, insertDocumentPartition } from "../../IModelSetupUtils";
import { collect } from "../../Utils";
import { NodeValidators, validateHierarchy } from "./HierarchyValidation";

describe("Hierarchies", () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Hierarchy level size limiting", () => {
    describe("root instance nodes", () => {
      let imodel: IModelConnection;
      let ruleset: Ruleset;
      let expectedInstanceKeys: InstanceKey[];

      before(async function () {
        // set up imodel with 2 DocumentPartition elements "a" and "b"
        expectedInstanceKeys = [];
        imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
          expectedInstanceKeys.push(insertDocumentPartition(db, "a"), insertDocumentPartition(db, "b"));
        });

        // set up ruleset
        ruleset = {
          id: Guid.createValue(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["DocumentPartition"],
                    },
                  ],
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
          ],
        };
      });

      it("succeeds without limiting", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset },
          expectedHierarchy: [
            NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
            NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "b" }),
          ],
        });
      });

      it("succeeds when result set size doesn't exceed given limit", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset, sizeLimit: 2 },
          expectedHierarchy: [
            NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
            NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "b" }),
          ],
        });
      });

      it("throws when result set size exceeds given limit", async () => {
        const iteratorPromise = Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset, sizeLimit: 1 });
        await expect(iteratorPromise).to.eventually.be.rejectedWith(PresentationError);
      });
    });

    describe("child instance nodes", () => {
      let imodel: IModelConnection;
      let ruleset: Ruleset;
      let expectedInstanceKeys: InstanceKey[];

      before(async function () {
        // set up imodel with 2 DocumentPartition elements "a" and "b"
        expectedInstanceKeys = [];
        imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
          expectedInstanceKeys.push(insertDocumentPartition(db, "a"), insertDocumentPartition(db, "b"));
        });

        // set up ruleset
        ruleset = {
          id: Guid.createValue(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["Subject"],
                    },
                  ],
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: RuleTypes.ChildNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
                  relationshipPaths: [
                    {
                      relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
                      direction: RelationshipDirection.Forward,
                      targetClass: { schemaName: "BisCore", className: "DocumentPartition" },
                    },
                  ],
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
          ],
        };
      });

      it("succeeds without limiting", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset },
          expectedHierarchy: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
              children: [
                NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
                NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "b" }),
              ],
            }),
          ],
        });
      });

      it("succeeds when result set size doesn't exceed given limit", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset, sizeLimit: 2 },
          expectedHierarchy: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
              children: [
                NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
                NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "b" }),
              ],
            }),
          ],
        });
      });

      it("throws when result set size exceeds given limit", async () => {
        const rootNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        const rootSubject = rootNodes[0];
        const iteratorPromise = Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: rootSubject.key, sizeLimit: 1 });
        await expect(iteratorPromise).to.eventually.be.rejectedWith(PresentationError);
      });
    });

    describe("grouping nodes", () => {
      let imodel: IModelConnection;
      let ruleset: Ruleset;
      let expectedInstanceKeys: InstanceKey[];

      before(async function () {
        // set up imodel with 2 DocumentPartition elements "a" and "b"
        expectedInstanceKeys = [];
        imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
          expectedInstanceKeys.push(insertDocumentPartition(db, "a1", "a"), insertDocumentPartition(db, "a2", "a"), insertDocumentPartition(db, "b"));
        });

        // set up ruleset for a hierarchy that looks like this:
        // - Document Partition (DocumentPartition class grouping node)
        //   - grouped-hierarchy-level-filtering (Model property grouping node)
        //    - a (label grouping node)
        //      - a (instance node #1)
        //      - a (instance node #2)
        //    - b (label grouping node)
        ruleset = {
          id: Guid.createValue(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["DocumentPartition"],
                    },
                  ],
                  groupByClass: true,
                  groupByLabel: true,
                },
              ],
            },
            {
              ruleType: RuleTypes.Grouping,
              class: { schemaName: "BisCore", className: "DocumentPartition" },
              groups: [
                {
                  specType: GroupingSpecificationTypes.Property,
                  propertyName: "Model",
                  createGroupForSingleItem: true,
                },
              ],
            },
          ],
        };
      });

      it("succeeds without limiting", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset },
          expectedHierarchy: [
            NodeValidators.createForClassGroupingNode({
              className: "BisCore:DocumentPartition",
              children: [
                NodeValidators.createForPropertyGroupingNode({
                  className: "BisCore:DocumentPartition",
                  propertyName: "Model",
                  children: [
                    NodeValidators.createForLabelGroupingNode({
                      label: "a",
                      children: [
                        NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
                        NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "a" }),
                      ],
                    }),
                    NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[2]], label: "b" }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("succeeds when result set size doesn't exceed given limit", async () => {
        await validateHierarchy({
          requestParams: { imodel, rulesetOrId: ruleset, sizeLimit: 3 },
          expectedHierarchy: [
            NodeValidators.createForClassGroupingNode({
              className: "BisCore:DocumentPartition",
              children: [
                NodeValidators.createForPropertyGroupingNode({
                  className: "BisCore:DocumentPartition",
                  propertyName: "Model",
                  children: [
                    NodeValidators.createForLabelGroupingNode({
                      label: "a",
                      children: [
                        NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[0]], label: "a" }),
                        NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[1]], label: "a" }),
                      ],
                    }),
                    NodeValidators.createForInstanceNode({ instanceKeys: [expectedInstanceKeys[2]], label: "b" }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("throws when result set size exceeds given limit", async () => {
        const classGroupingNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        const classGroupingNode = classGroupingNodes[0];
        await expect(
          Presentation.presentation
            .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNode.key, sizeLimit: 2 })
            .then(async ({ items }) => collect(items)),
        ).to.eventually.be.rejectedWith(PresentationError);

        const propertyGroupingNodes = await Presentation.presentation
          .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNode.key })
          .then(async (x) => collect(x.items));
        const propertyGroupingNode = propertyGroupingNodes[0];
        await expect(
          Presentation.presentation
            .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: propertyGroupingNode.key, sizeLimit: 2 })
            .then(async ({ items }) => collect(items)),
        ).to.eventually.be.rejectedWith(PresentationError);

        const labelGroupingNodes = await Presentation.presentation
          .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: propertyGroupingNode.key })
          .then(async (x) => collect(x.items));
        const labelGroupingNode = labelGroupingNodes[0];
        await expect(
          Presentation.presentation
            .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: labelGroupingNode.key, sizeLimit: 1 })
            .then(async ({ items }) => collect(items)),
        ).to.eventually.be.rejectedWith(PresentationError);
      });
    });
  });
});
