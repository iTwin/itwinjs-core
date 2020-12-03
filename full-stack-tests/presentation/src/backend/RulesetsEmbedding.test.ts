/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import faker from "faker";
import fs from "fs";
import { ClientRequestContext, Id64 } from "@bentley/bentleyjs-core";
import { SnapshotDb } from "@bentley/imodeljs-backend";
import { DuplicateRulesetHandlingStrategy, Presentation, PresentationManagerMode, RulesetEmbedder } from "@bentley/presentation-backend";
import { createDefaultNativePlatform, NativePlatformDefinition } from "@bentley/presentation-backend/lib/presentation-backend/NativePlatform";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@bentley/presentation-common";
import { createRandomRuleset } from "@bentley/presentation-common/lib/test/_helpers/random";
import { initialize, terminate } from "../IntegrationTests";
import { tweakRuleset } from "./Helpers";

const RULESET_1: Ruleset = {
  id: "ruleset_1",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "test 1",
      label: "label 1",
    }],
  }],
};

const RULESET_2: Ruleset = {
  id: "ruleset_2",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "test 2",
      label: "label 2",
    }],
  }],
};

describe("RulesEmbedding", () => {
  let imodel: SnapshotDb;
  let embedder: RulesetEmbedder;
  let ruleset: Ruleset;
  let nativePlatform: NativePlatformDefinition;
  const testIModelName: string = "assets/datasets/RulesetEmbeddingTest.ibim";

  function expectRulesetsToBeDeepEqual(expected: Ruleset, actual: Ruleset): void {
    tweakRuleset<Ruleset>(expected, actual);
    expect(expected).to.deep.equal(actual);
  }

  function expectRulesetsToNotBeDeepEqual(expected: Ruleset, actual: Ruleset): void {
    tweakRuleset<Ruleset>(expected, actual);
    expect(expected).to.not.deep.equal(actual);
  }

  function createSnapshotFromSeed(testFileName: string, seedFileName: string): SnapshotDb {
    const seedDb = SnapshotDb.openFile(seedFileName);
    const testDb = SnapshotDb.createFrom(seedDb, testFileName);
    seedDb.close();
    return testDb;
  }

  before(async () => {
    await initialize();
    const TNativePlatform = createDefaultNativePlatform({ // eslint-disable-line @typescript-eslint/naming-convention
      id: "",
      localeDirectories: [],
      taskAllocationsMap: {},
      mode: PresentationManagerMode.ReadWrite,
      isChangeTrackingEnabled: false,
    });
    nativePlatform = new TNativePlatform();
    imodel = createSnapshotFromSeed(testIModelName, "assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    nativePlatform.dispose();

    fs.unlink(testIModelName, (err: Error) => {
      if (err)
        expect(false);
    });
    await terminate();
  });

  beforeEach(async () => {
    embedder = new RulesetEmbedder({ imodel });
    ruleset = await createRandomRuleset();
  });

  afterEach(async () => {
    imodel.abandonChanges();
  });

  it("handles getting rulesets with nothing inserted", async () => {
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equal(0);
  });

  it("inserts a ruleset to iModel and retrieves it", async () => {
    // Insert a ruleset
    const insertId = await embedder.insertRuleset(ruleset);
    expect(Id64.isValid(insertId)).true;

    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);

    expectRulesetsToBeDeepEqual(ruleset, rulesets[0]);
  });

  it("inserts multiple different rulesets to iModel", async () => {
    // Create another ruleset
    const otherRuleset = { ...(await createRandomRuleset()), id: `${ruleset.id}_different` };

    // Insert a ruleset
    const insertId1 = await embedder.insertRuleset(ruleset);
    const insertId2 = await embedder.insertRuleset(otherRuleset);
    expect(Id64.isValid(insertId1)).true;
    expect(Id64.isValid(insertId2)).true;

    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(2);

    const actualRuleset = rulesets.find((value: Ruleset, _index: number, _obj: Ruleset[]): boolean => value.id === ruleset.id);
    expect(actualRuleset).to.not.be.undefined;
    expectRulesetsToBeDeepEqual(ruleset, actualRuleset as Ruleset);

    const actualOtherRuleset = rulesets.find((value: Ruleset, _index: number, _obj: Ruleset[]): boolean => value.id === otherRuleset.id);
    expect(actualOtherRuleset).to.not.be.undefined;
    expectRulesetsToBeDeepEqual(otherRuleset, actualOtherRuleset as Ruleset);
  });

  it("locates rulesets", async () => {
    // Create a ruleset and insert it
    const insertId = await embedder.insertRuleset(RULESET_1);
    expect(Id64.isValid(insertId)).true;

    // Try getting root node to confirm embedded ruleset is being located
    const rootNodes = await Presentation.getManager().getNodes({ requestContext: ClientRequestContext.current, imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);
  });

  it("locates rulesets correctly if rules are updated", async () => {
    // Create a ruleset and insert it
    const insertId = await embedder.insertRuleset(RULESET_1);
    expect(Id64.isValid(insertId)).true;

    // Try getting root node to confirm embedded ruleset is being located
    let rootNodes = await Presentation.getManager().getNodes({ requestContext: ClientRequestContext.current, imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);

    const rulesetElement = imodel.elements.getElement(insertId);
    rulesetElement.setJsonProperty("id", faker.random.uuid());
    imodel.elements.updateElement(rulesetElement);

    rootNodes = await Presentation.getManager().getNodes({ requestContext: ClientRequestContext.current, imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);
  });

  it("does not insert same ruleset to iModel multiple times", async () => {
    // Insert a ruleset
    const insertId1 = await embedder.insertRuleset(ruleset);
    const insertId2 = await embedder.insertRuleset(ruleset);
    expect(Id64.isValid(insertId1)).true;
    expect(insertId1).to.be.equal(insertId2);
    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);
  });

  it("skips inserting duplicate ruleset", async () => {
    const insertId1 = await embedder.insertRuleset(ruleset, DuplicateRulesetHandlingStrategy.Skip);
    expect(Id64.isValid(insertId1)).true;

    const rulesetChanged = { ...RULESET_2, id: ruleset.id };
    expectRulesetsToNotBeDeepEqual(ruleset, rulesetChanged);
    expect(ruleset.id).to.be.equal(rulesetChanged.id);

    const insertId2 = await embedder.insertRuleset(rulesetChanged, DuplicateRulesetHandlingStrategy.Skip);
    expect(insertId1).to.be.equal(insertId2);

    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);

    expectRulesetsToBeDeepEqual(ruleset, rulesets[0]);
    expectRulesetsToNotBeDeepEqual(rulesetChanged, rulesets[0]);
  });

  it("replaces when inserting duplicate ruleset", async () => {
    const insertId1 = await embedder.insertRuleset(ruleset, DuplicateRulesetHandlingStrategy.Replace);
    expect(Id64.isValid(insertId1)).true;

    const rulesetChanged = { ...RULESET_2, id: ruleset.id };
    expectRulesetsToNotBeDeepEqual(ruleset, rulesetChanged);
    expect(ruleset.id).to.be.equal(rulesetChanged.id);

    const insertId2 = await embedder.insertRuleset(rulesetChanged, DuplicateRulesetHandlingStrategy.Replace);
    expect(insertId1).to.be.equal(insertId2);

    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);

    expectRulesetsToBeDeepEqual(rulesetChanged, rulesets[0]);
    expectRulesetsToNotBeDeepEqual(ruleset, rulesets[0]);
  });
});
