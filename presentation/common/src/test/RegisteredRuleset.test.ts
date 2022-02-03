/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import type { Ruleset} from "../presentation-common";
import { RegisteredRuleset, RuleTypes } from "../presentation-common";

describe("RegisteredRuleset", () => {

  let uniqueIdentifier: string;
  const managerMock = moq.Mock.ofInstance(function remove(ruleset: RegisteredRuleset): void { ruleset; });

  beforeEach(() => {
    managerMock.reset();
    uniqueIdentifier = faker.random.uuid();
  });

  describe("Ruleset implementation", () => {

    let ruleset: Ruleset;
    let registered: RegisteredRuleset;
    beforeEach(() => {
      ruleset = {
        id: faker.random.uuid(),
        requiredSchemas: [
          {
            name: faker.random.word(),
          },
        ],
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
      registered = new RegisteredRuleset(ruleset, uniqueIdentifier, (r: RegisteredRuleset) => managerMock.object(r));
    });

    it("returns wrapper ruleset properties", () => {
      expect(registered.uniqueIdentifier).to.eq(uniqueIdentifier);
      expect(registered.id).to.deep.equal(ruleset.id);
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
      const registered = new RegisteredRuleset(ruleset, uniqueIdentifier, (r: RegisteredRuleset) => managerMock.object(r));
      registered.dispose();
      managerMock.verify((x) => x(registered), moq.Times.once());
    });

  });

});
