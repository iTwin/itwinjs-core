/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { IRulesetManager, RegisteredRuleset } from "@src/IRulesetManager";
import { Ruleset, RuleTypes } from "@src/rules";

describe("RegisteredRuleset", () => {

  const managerMock = moq.Mock.ofType<IRulesetManager>();
  beforeEach(() => {
    managerMock.reset();
  });

  describe("Ruleset implementation", () => {

    let ruleset: Ruleset;
    let registered: RegisteredRuleset;
    beforeEach(() => {
      ruleset = {
        id: faker.random.uuid(),
        supportedSchemas: { schemaNames: [faker.random.word()] },
        supplementationInfo: {
          supplementationPurpose: faker.random.words(),
        },
        rules: [{
          ruleType: RuleTypes.RootNodes,
          autoExpand: faker.random.boolean(),
        }],
        vars: [{
          label: faker.random.words(),
          vars: [],
        }],
      };
      registered = new RegisteredRuleset(managerMock.object, ruleset);
    });

    it("returns wrapper ruleset properties", () => {
      expect(registered.id).to.deep.equal(ruleset.id);
      expect(registered.supportedSchemas).to.deep.equal(ruleset.supportedSchemas);
      expect(registered.supplementationInfo).to.deep.equal(ruleset.supplementationInfo);
      expect(registered.rules).to.deep.equal(ruleset.rules);
      expect(registered.vars).to.deep.equal(ruleset.vars);
      expect(registered.toJSON()).to.deep.equal(ruleset);
    });

  });

  describe("dispose", () => {

    it("unregisters ruleset from IRulesetManager", () => {
      const ruleset: Ruleset = {
        id: faker.random.uuid(),
        rules: [],
      };
      const registered = new RegisteredRuleset(managerMock.object, ruleset);
      registered.dispose();
      managerMock.verify((x) => x.remove(registered), moq.Times.once());
    });

  });

});
