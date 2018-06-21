/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "./IntegrationTests";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import {
  PresentationRuleSpecificationTypes, PresentationRuleTypes,
  PresentationRuleSet, RelationshipDirection, InstanceKey,
} from "@bentley/ecpresentation-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("NodesPaths", async () => {

  let imodel: IModelConnection;

  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  /*
  filter r1
    filter ch1
    other ch2
    other ch3
      filter ch4
  other r2
  other r3
    other ch5
    filter ch6
  */
  const getFilteredNodePathsRuleset: PresentationRuleSet = {
    ruleSetId: "CustomNodesRuleset",
    rules: [{
      type: PresentationRuleTypes.RootNodeRule,
      specifications: [{
        type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
        label: "filter r1",
        nodeType: "nodeType",
        imageId: "imageId",
        description: "description",
        nestedRules: [{
          type: PresentationRuleTypes.ChildNodeRule,
          specifications: [{
            type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
            label: "filter ch1",
            nodeType: "nodeType",
            imageId: "imageId",
            description: "description",
          }, {
            type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
            label: "other ch2",
            nodeType: "nodeType",
            imageId: "imageId",
            description: "description",
          }, {
            type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
            label: "other ch3",
            nodeType: "nodeType",
            imageId: "imageId",
            description: "description",
            nestedRules: [{
              type: PresentationRuleTypes.ChildNodeRule,
              specifications: [{
                type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
                label: "filter ch4",
                nodeType: "nodeType",
                imageId: "imageId",
                description: "description",
              }],
            }],
          }],
        }],
      }, {
        type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
        label: "other r2",
        nodeType: "nodeType",
        imageId: "imageId",
        description: "description",
      }, {
        type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
        label: "other r3",
        nodeType: "nodeType",
        imageId: "imageId",
        description: "description",
        nestedRules: [{
          type: PresentationRuleTypes.ChildNodeRule,
          specifications: [{
            type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
            label: "other ch5",
            nodeType: "nodeType",
            imageId: "imageId",
            description: "description",
          }, {
            type: PresentationRuleSpecificationTypes.CustomNodeSpecification,
            label: "filter ch6",
            nodeType: "nodeType",
            imageId: "imageId",
            description: "description",
          }],
        }],
      }],
    }],
  };
  it("gets filtered node paths", async () => {
    await ECPresentation.presentation.addRuleSet(getFilteredNodePathsRuleset);
    const result = await ECPresentation.presentation.getFilteredNodePaths(imodel, "filter", { RulesetId: getFilteredNodePathsRuleset.ruleSetId });
    expect(result).to.matchSnapshot();
  });

  const getNodePathsTestRuleset: PresentationRuleSet = {
    ruleSetId: "JsonRuleSet",
    rules: [{
      type: PresentationRuleTypes.RootNodeRule,
      specifications: [{
        type: PresentationRuleSpecificationTypes.InstanceNodesOfSpecificClassesSpecification,
        classNames: "BisCore:RepositoryModel",
        groupByClass: false,
        nestedRules: [{
          type: PresentationRuleTypes.ChildNodeRule,
          specifications: [{
            relatedClassNames: "BisCore:Subject",
            relationshipClassNames: "BisCore:ModelContainsElements",
            requiredDirection: RelationshipDirection.Forward,
            groupByClass: false,
            groupByLabels: false,
            type: PresentationRuleSpecificationTypes.RelatedInstanceNodesSpecification,
            nestedRules: [{
              type: PresentationRuleTypes.ChildNodeRule,
              specifications: [{
                relationshipClassNames: "BisCore:ElementOwnsChildElements",
                requiredDirection: RelationshipDirection.Forward,
                groupByClass: true,
                groupByLabels: false,
                type: PresentationRuleSpecificationTypes.RelatedInstanceNodesSpecification,
              }],
            }],
          }],
        }],
      }],
    }],
  };
  it("gets node paths", async () => {
    await ECPresentation.presentation.addRuleSet(getNodePathsTestRuleset);
    const key1: InstanceKey = { id: new Id64("0x1"), className: "BisCore:RepositoryModel" };
    const key2: InstanceKey = { id: new Id64("0x1"), className: "BisCore:Subject" };
    const key3: InstanceKey = { id: new Id64("0x12"), className: "BisCore:PhysicalPartition" };
    const key4: InstanceKey = { id: new Id64("0xe"), className: "BisCore:LinkPartition" };
    const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];

    const result = await ECPresentation.presentation.getNodePaths(imodel, keys, 1, { RulesetId: getNodePathsTestRuleset.ruleSetId });
    expect(result).to.matchSnapshot();
  });

});
