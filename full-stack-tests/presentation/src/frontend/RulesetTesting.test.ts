/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// eslint-disable prefer-arrow/prefer-arrow-functions
import { expect } from "chai";
import * as ChaiJestSnapshot from "chai-jest-snapshot";
import path from "path";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, ContentSpecificationTypes, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { ContentBuilder, HierarchyBuilder } from "@itwin/presentation-testing";
import { initialize, terminate, testLocalization } from "../IntegrationTests";

const iModelPath = "assets/datasets/Properties_60InstancesWithUrl2.ibim";

const MY_HIERARCHY_RULESET: Ruleset = {
  id: "my-test-hierarchy",
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

const MY_CONTENT_RULESET: Ruleset = {
  id: "my-test-content",
  rules: [{
    ruleType: RuleTypes.Content,
    specifications: [{
      specType: ContentSpecificationTypes.SelectedNodeInstances,
    }],
  }],
};

describe("RulesetTesting", () => {

  beforeEach(() => {
    // this needs to be called to reset the default snapshots set up in `setup-tests.js`,
    // otherwise passing file and test names to `matchSnapshot` has no effect
    ChaiJestSnapshot.setFilename("");
    ChaiJestSnapshot.setTestName("");
  });

  let iModel: IModelConnection;

  before(async () => {
    // __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets.Setup
    // initialize presentation-testing
    await initialize({ localization: testLocalization });

    // set up for testing iModel presentation data
    iModel = await SnapshotConnection.openFile(iModelPath);
    // __PUBLISH_EXTRACT_END__
  });

  after(async () => {
    // __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets.Terminate
    // close the tested iModel
    await iModel.close();

    // terminate presentation-testing
    await terminate();
    // __PUBLISH_EXTRACT_END__
  });

  // set up a function to create snapshot file path - we want the snapshots to be placed next
  // to source file
  function createSnapshotPath(currentTest: Mocha.Runnable, fileName: string) {
    return path.join(
      path.dirname(currentTest.file!).replace(/(?!\\|\/)(lib)(?=\\|\/)/g, "src"),
      `ruleset-testing-snapshots`,
      `${fileName}.snap`,
    );
  }

  // __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets.Hierarchies
  it("generates correct hierarchy", async function () {
    const builder = new HierarchyBuilder({ imodel: iModel });

    // generate the hierarchy using our custom ruleset
    const hierarchy = await builder.createHierarchy(MY_HIERARCHY_RULESET);

    // verify it through snapshot
    expect(hierarchy).to.matchSnapshot(createSnapshotPath(this.test!, MY_HIERARCHY_RULESET.id), MY_HIERARCHY_RULESET.id);
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Presentation.Testing.Rulesets.Content
  it("generates correct content", async function () {
    const builder = new ContentBuilder({ imodel: iModel, decimalPrecision: 8 });

    // generate content using our custom ruleset
    const instances = await builder.createContentForInstancePerClass(MY_CONTENT_RULESET);

    // verify through snapshot by looping through each instance and creating a separate
    // snapshot file for each type of instance
    for (const instance of instances) {
      const testName = instance.className.replace(":", ".").replace(/__x0020__/g, "_");
      expect(instance.records).to.matchSnapshot(createSnapshotPath(this.test!, `${MY_CONTENT_RULESET.id}-${testName}`), testName);
    }
  });
  // __PUBLISH_EXTRACT_END__

});
