/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IRulesetManager, RegisteredRuleSet } from "@src/IRulesetManager";
import { PresentationRuleSet, PresentationRuleTypes } from "@src/rules";

describe("RegisteredRuleSet", () => {

  const managerMock = moq.Mock.ofType<IRulesetManager>();
  beforeEach(() => {
    managerMock.reset();
  });

  describe("PresentationRuleSet implementation", () => {

    let ruleset: PresentationRuleSet;
    let registered: RegisteredRuleSet;
    beforeEach(() => {
      ruleset = {
        ruleSetId: faker.random.uuid(),
        supportedSchemas: faker.random.words(),
        isSupplemental: faker.random.boolean(),
        supplementalPurpose: faker.random.words(),
        versionMajor: faker.random.number(),
        versionMinor: faker.random.number(),
        rules: [{
          type: PresentationRuleTypes.RootNodeRule,
          autoExpand: faker.random.boolean(),
        }],
        contentModifiers: [{
          schemaName: faker.random.word(),
          className: faker.random.word(),
        }],
        userSettings: [{
          categoryLabel: faker.random.words(),
        }],
      };
      registered = new RegisteredRuleSet(managerMock.object, ruleset);
    });

    it("returns wrapper ruleset properties", () => {
      expect(registered.ruleSetId).to.deep.equal(ruleset.ruleSetId);
      expect(registered.supportedSchemas).to.deep.equal(ruleset.supportedSchemas);
      expect(registered.isSupplemental).to.deep.equal(ruleset.isSupplemental);
      expect(registered.supplementalPurpose).to.deep.equal(ruleset.supplementalPurpose);
      expect(registered.versionMajor).to.deep.equal(ruleset.versionMajor);
      expect(registered.versionMinor).to.deep.equal(ruleset.versionMinor);
      expect(registered.rules).to.deep.equal(ruleset.rules);
      expect(registered.contentModifiers).to.deep.equal(ruleset.contentModifiers);
      expect(registered.userSettings).to.deep.equal(ruleset.userSettings);
    });

  });

  describe("dispose", () => {

    it("unregisters ruleset from IRulesetManager", () => {
      const ruleset: PresentationRuleSet = {
        ruleSetId: faker.random.uuid(),
      };
      const registered = new RegisteredRuleSet(managerMock.object, ruleset);
      registered.dispose();
      managerMock.verify((x) => x.remove(registered), moq.Times.once());
    });

  });

});
