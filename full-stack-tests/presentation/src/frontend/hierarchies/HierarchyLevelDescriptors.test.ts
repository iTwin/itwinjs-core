/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import {
  ChildNodeSpecificationTypes,
  Descriptor,
  InstanceKey,
  PresentationError,
  PropertyValueFormat,
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

  describe("Getting hierarchy level descriptors", () => {
    it("creates descriptor for root hierarchy level", async function () {
      // create an "empty" iModel - we'll use the root Subject for our test
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
                    arePolymorphic: false,
                  },
                ],
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      };

      const result = await Presentation.presentation.getNodesDescriptor({ imodel, rulesetOrId: ruleset });
      expect(result).to.containSubset({
        selectClasses: [
          {
            selectClassInfo: { name: "BisCore:Subject" },
          },
        ],
        fields: [
          {
            label: "Model",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "navigation" },
          },
          {
            label: "Code",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
          {
            label: "User Label",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
          {
            label: "Description",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
        ],
      } as Partial<Descriptor>);
    });

    it("creates descriptor for child hierarchy level", async function () {
      // create an "empty" iModel - we'll use the root Subject and default Models for our test
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
                    arePolymorphic: false,
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
                specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
                relationshipPaths: [
                  [
                    {
                      relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
                      direction: RelationshipDirection.Forward,
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                      direction: RelationshipDirection.Backward,
                    },
                  ],
                ],
              },
            ],
          },
        ],
      };

      const rootNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
      expect(rootNodes.length).to.eq(1);

      const result = await Presentation.presentation.getNodesDescriptor({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
      expect(result).to.containSubset({
        selectClasses: [
          {
            selectClassInfo: { name: "BisCore:DictionaryModel" },
          },
          {
            selectClassInfo: { name: "BisCore:LinkModel" },
          },
        ],
        fields: [
          {
            label: "Modeled Element",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "navigation" },
          },
        ],
      } as Partial<Descriptor>);
    });

    it("creates descriptor for hierarchy level that uses `parent` ECExpression symbol in instance filter", async function () {
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

      // validate the hierarchy
      const hierarchy = await validateHierarchy({
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

      // validate the descriptor
      const result = await Presentation.presentation.getNodesDescriptor({ imodel, rulesetOrId: ruleset, parentKey: hierarchy[0].node });
      expect(result).to.containSubset({
        selectClasses: [
          {
            selectClassInfo: { name: "BisCore:DocumentPartition" },
            relatedInstancePaths: [
              [
                {
                  targetClassInfo: { name: "BisCore:Subject" },
                  targetInstanceIds: [IModel.rootSubjectId],
                },
              ],
            ],
          },
        ],
        fields: [
          {
            label: "Model",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "navigation" },
          },
          {
            label: "Code",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
          {
            label: "User Label",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
          {
            label: "Description",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          },
        ],
        ruleset: {
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["DocumentPartition"],
                    },
                  ],
                  relatedInstances: [
                    {
                      targetInstances: {
                        class: { schemaName: "BisCore", className: "Subject" },
                        instanceIds: [IModel.rootSubjectId],
                      },
                      alias: "parent",
                      isRequired: true,
                    },
                  ],
                  instanceFilter: "parent.ECInstanceId = this.Parent.Id",
                },
              ],
            },
          ],
        },
      } as Partial<Descriptor>);
    });

    it("throws when attempting to get descriptor non-filterable hierarchy level", async function () {
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

      // ensure requesting the hierarchy level descriptor throws
      await expect(Presentation.presentation.getNodesDescriptor({ imodel, rulesetOrId: ruleset })).to.eventually.be.rejectedWith(PresentationError);
    });
  });
});
