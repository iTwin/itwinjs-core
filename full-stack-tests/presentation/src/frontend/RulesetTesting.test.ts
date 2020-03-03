/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HierarchyBuilder, ContentBuilder, ContentBuilderResult } from "@bentley/presentation-testing";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { initialize, terminate } from "../IntegrationTests";
import * as ChaiJestSnapshot from "chai-jest-snapshot";
import path from "path";
import { Ruleset, RuleTypes, ContentSpecificationTypes, ChildNodeSpecificationTypes, RelationshipDirection } from "@bentley/presentation-common";

function configureSnapshotLocation(test: Mocha.Runnable, subdirectory: string, instance: ContentBuilderResult) {
  let fileName = path.join(
    path.dirname(test.file!).replace(/(?!\\|\/)(lib)(?=\\|\/)/g, "src"),
    subdirectory,
    `${instance.className.replace(":", ".")}.snap`);

  fileName = fileName.replace(/__x0020__/g, "_");
  ChaiJestSnapshot.setFilename(fileName);
  ChaiJestSnapshot.setTestName(`${test.fullTitle()}. ClassName: '${instance.className}'`);
}

// __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets
describe("RulesetTesting", () => {
  let imodel: IModelConnection;
  const imodelPath = "assets/datasets/Properties_60InstancesWithUrl2.ibim";

  before(async () => {
    // initialize presentation-testing
    await initialize();
  });

  after(() => {
    // terminate presentation-testing
    terminate();
  });

  beforeEach(async () => {
    // set up for testing imodel presentation data
    imodel = await IModelConnection.openSnapshot(imodelPath);
  });

  afterEach(async () => {
    await imodel.closeSnapshot();
  });

  it("generates correct hierarchy", async () => {
    const ruleset: Ruleset = {
      id: "test",
      rules: [{
        ruleType: RuleTypes.RootNodes,
        autoExpand: true,
        specifications: [{
          specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
          classes: [{
            schemaName: "BisCore",
            classNames: ["Subject"],
          }],
          instanceFilter: "this.Parent = NULL",
          arePolymorphic: false,
          groupByClass: false,
          groupByLabel: false,
        }],
      }, {
        ruleType: RuleTypes.ChildNodes,
        condition: "ParentNode.IsOfClass(\"Subject\", \"BisCore\")",
        onlyIfNotHandled: true,
        specifications: [{
          specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
          relationshipPaths: [{
            relationship: {
              schemaName: "BisCore",
              className: "SubjectOwnsSubjects",
            },
            direction: RelationshipDirection.Forward,
          }],
          groupByClass: false,
          groupByLabel: false,
        }, {
          specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
          classes: {
            schemaName: "BisCore",
            classNames: ["Model"],
          },
          arePolymorphic: true,
          relatedInstances: [{
            relationshipPath: {
              relationship: {
                schemaName: "BisCore",
                className: "ModelModelsElement",
              },
              direction: RelationshipDirection.Forward,
              targetClass: {
                schemaName: "BisCore",
                className: "InformationPartitionElement",
              },
            },
            alias: "partition",
            isRequired: true,
          }],
          instanceFilter: "partition.Parent.Id = parent.ECInstanceId AND NOT this.IsPrivate",
          groupByClass: false,
          groupByLabel: false,
        }],
      }, {
        ruleType: RuleTypes.ChildNodes,
        condition: "ParentNode.IsOfClass(\"Model\", \"BisCore\")",
        onlyIfNotHandled: true,
        specifications: [{
          specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
          relationshipPaths: [{
            relationship: {
              schemaName: "BisCore",
              className: "ModelContainsElements",
            },
            direction: RelationshipDirection.Forward,
          }],
          instanceFilter: "this.Parent = NULL",
          groupByClass: false,
          groupByLabel: false,
        }],
      }, {
        ruleType: RuleTypes.ChildNodes,
        condition: "ParentNode.IsOfClass(\"Element\", \"BisCore\")",
        onlyIfNotHandled: true,
        specifications: [{
          specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
          relationshipPaths: [{
            relationship: {
              schemaName: "BisCore",
              className: "ElementOwnsChildElements",
            },
            direction: RelationshipDirection.Forward,
          }],
          groupByClass: false,
          groupByLabel: false,
        }],
      }],
    };
    const builder = new HierarchyBuilder({ imodel });
    // generate the hierarchy using a ruleset id
    const hierarchy = await builder.createHierarchy(ruleset);
    // verify through snapshot
    expect(hierarchy).to.matchSnapshot();
  });

  // VSTS#156270
  // tslint:disable-next-line:only-arrow-functions
  it.skip("generates correct content", async function () {
    const ruleset: Ruleset = {
      id: "test",
      rules: [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.SelectedNodeInstances,
        }],
      }],
    };
    const builder = new ContentBuilder({ imodel });
    // generate content using ruleset id
    const instances = await builder.createContentForInstancePerClass(ruleset);

    // verify through snapshot
    // we loop through each instance and create a separate snapshot file
    // because snapshot engine has difficulties parsing big files
    for (const instance of instances) {
      // not providing filename and snapshot name to the 'matchSnapshot', because it seems
      // to ignore them when ChaiJestSnapshot.setFilename and setTestName is used
      configureSnapshotLocation(this.test!, "ruleset-testing-content-snaps", instance);
      expect(instance.records).to.matchSnapshot();
    }
  });

});
// __PUBLISH_EXTRACT_END__
