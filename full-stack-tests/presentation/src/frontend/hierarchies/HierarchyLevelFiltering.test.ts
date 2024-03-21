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
  HierarchyRequestOptions,
  InstanceKey,
  NodeKey,
  PresentationError,
  RelationshipDirection,
  Ruleset,
  RulesetVariable,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { buildTestIModelConnection, insertDocumentPartition } from "../../IModelSetupUtils";
import { NodeValidators, validateHierarchy } from "./HierarchyValidation";

describe("Hierarchies", () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Hierarchy level filtering", () => {
    it("filters root instance nodes hierarchy level", async function () {
      // set up imodel with 2 DocumentPartition elements "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        imodelElementKeys.push(insertDocumentPartition(db, "a"), insertDocumentPartition(db, "b"));
      });

      // set up ruleset
      const ruleset: Ruleset = {
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
                    arePolymorphic: true,
                  },
                ],
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
        ],
        supportsFiltering: true,
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.CodeValue = "b"`,
          },
        },
        expectedHierarchy: [NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" })],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.Model.Id = ${IModel.repositoryModelId}`,
          },
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.CodeValue = "x"`,
          },
        },
        expectedHierarchy: [],
      });
    });

    it("filters child instance nodes hierarchy level", async function () {
      // set up imodel with 2 DocumentPartition elements "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        imodelElementKeys.push(insertDocumentPartition(db, "a"), insertDocumentPartition(db, "b"));
      });

      // set up ruleset
      const ruleset: Ruleset = {
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

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
            supportsFiltering: true,
          }),
        ],
        supportsFiltering: true,
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.CodeValue = "b"`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" })],
          }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.Model.Id = ${IModel.repositoryModelId}`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
          }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.CodeValue = "x"`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            expectChildren: true,
            children: [],
          }),
        ],
      });
    });

    it("filters guid properties", async function () {
      const imodelElementKeys: InstanceKey[] = [];
      const guidA = "814f3e14-63f2-4511-89a8-43ff3b527492";
      const guidB = "182238d2-e836-4640-9b40-38be6ca49623";

      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        imodelElementKeys.push(insertDocumentPartition(db, "a", "a", guidA), insertDocumentPartition(db, "b", "b", guidB));
      });

      const ruleset: Ruleset = {
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
                    arePolymorphic: true,
                  },
                ],
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
          {
            ruleType: RuleTypes.Grouping,
            class: { schemaName: "BisCore", className: "DocumentPartition" },
            groups: [
              {
                specType: GroupingSpecificationTypes.Property,
                propertyName: "FederationGuid",
                createGroupForSingleItem: true,
              },
            ],
          },
        ],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForPropertyGroupingNode({
            propertyName: "FederationGuid",
            className: "BisCore:DocumentPartition",
            groupingValues: [guidA],
            label: guidA,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [imodelElementKeys[0]],
                label: "a",
              }),
            ],
            supportsFiltering: true,
          }),
          NodeValidators.createForPropertyGroupingNode({
            propertyName: "FederationGuid",
            className: "BisCore:DocumentPartition",
            groupingValues: [guidB],
            label: guidB,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [imodelElementKeys[1]],
                label: "b",
              }),
            ],
            supportsFiltering: true,
          }),
        ],
        supportsFiltering: true,
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `GuidToStr(this.FederationGuid) = "${guidA}"`,
          },
        },
        expectedHierarchy: [
          NodeValidators.createForPropertyGroupingNode({
            className: "BisCore:DocumentPartition",
            propertyName: "FederationGuid",
            children: [NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" })],
          }),
        ],
      });
    });

    it("filters grouped hierarchy levels", async function () {
      // set up imodel with 3 DocumentPartition elements: "a", "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        imodelElementKeys.push(insertDocumentPartition(db, "a1", "a"), insertDocumentPartition(db, "a2", "a"), insertDocumentPartition(db, "b"));
      });

      // set up ruleset for a hierarchy that looks like this:
      // - Document Partition (DocumentPartition class grouping node)
      //   - grouped-hierarchy-level-filtering (Model property grouping node)
      //    - a (label grouping node)
      //      - a (instance node #1)
      //      - a (instance node #2)
      //    - b (label grouping node)
      const ruleset: Ruleset = {
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
                    arePolymorphic: true,
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

      // validate nodes without any filter
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
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                    ],
                    supportsFiltering: true,
                  }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[2]], label: "b" }),
                ],
                supportsFiltering: true,
              }),
            ],
            supportsFiltering: true,
          }),
        ],
        supportsFiltering: true,
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.UserLabel = "a"`,
          },
        },
        expectedHierarchy: [
          NodeValidators.createForClassGroupingNode({
            className: "BisCore:DocumentPartition",
            children: [
              NodeValidators.createForPropertyGroupingNode({
                className: "BisCore:DocumentPartition",
                propertyName: "Model",
                children: [
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                ],
              }),
            ],
          }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.Model.Id = ${IModel.repositoryModelId}`,
          },
        },
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
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[2]], label: "b" }),
                ],
              }),
            ],
          }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: {
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {
            selectClassName: imodelElementKeys[0].className,
            expression: `this.CodeValue = "x"`,
          },
        },
        expectedHierarchy: [],
      });
    });

    it("filters hierarchy levels that use `parent` ECExpression symbol in instance filter", async function () {
      // set up imodel with 2 DocumentPartition elements "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        imodelElementKeys.push(insertDocumentPartition(db, "a"), insertDocumentPartition(db, "b"));
      });

      // set up ruleset
      const ruleset: Ruleset = {
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
            condition: `ParentNode.IsOfClass("Subject", "BisCore")`,
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["DocumentPartition"] },
                instanceFilter: `parent.ECInstanceId = this.Parent.Id`,
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
            supportsFiltering: true,
          }),
        ],
        supportsFiltering: true,
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.CodeValue = "b"`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" })],
          }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.Model.Id = ${IModel.repositoryModelId}`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
          }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (
            params.parentKey &&
            NodeKey.isInstancesNodeKey(params.parentKey) &&
            params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject")
          ) {
            params.instanceFilter = {
              selectClassName: imodelElementKeys[0].className,
              expression: `this.CodeValue = "x"`,
            };
          }
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            expectChildren: true,
            children: [],
          }),
        ],
      });
    });

    it("throws when attempting to filter non-filterable hierarchy level", async function () {
      // set up an empty imodel - we'll use the root Subject for this test
      const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (_) => {});

      // set up ruleset
      const ruleset: Ruleset = {
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
                // hierarchy levels built with hide expressions don't support filtering
                hideExpression: `FALSE`,
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      };

      // ensure the root nodes are returned with `supportsFiltering = false`
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [NodeValidators.createForInstanceNode({ instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }] })],
        supportsFiltering: false,
      });

      // ensure requesting the hierarchy level with an instance filter throws
      const requestParams: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable> = {
        imodel,
        rulesetOrId: ruleset,
        instanceFilter: {
          selectClassName: "BisCore:Subject",
          expression: `TRUE`,
        },
      };
      const iteratorPromise = Presentation.presentation.getNodesIterator(requestParams);
      await expect(iteratorPromise).to.eventually.be.rejectedWith(PresentationError);
    });
  });
});
