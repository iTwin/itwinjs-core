/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { RegisteredRuleset, Ruleset, RuleTypes } from "../presentation-common.js";

describe("RegisteredRuleset", () => {
  let uniqueIdentifier: string;
  const managerMock = moq.Mock.ofInstance(function remove(ruleset: RegisteredRuleset): void {
    ruleset;
  });

  beforeEach(() => {
    managerMock.reset();
    uniqueIdentifier = "unique-id";
  });

  describe("Ruleset implementation", () => {
    let ruleset: Ruleset;
    let registered: RegisteredRuleset;
    beforeEach(() => {
      ruleset = {
        id: "test-ruleset",
        requiredSchemas: [
          {
            name: "TestSchema",
          },
        ],
        supplementationInfo: {
          supplementationPurpose: "test-supplementation-purpose",
        },
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            autoExpand: false,
          },
        ],
        vars: [
          {
            label: "test label",
            vars: [],
          },
        ],
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
        id: "test-ruleset",
        rules: [],
      };
      const registered = new RegisteredRuleset(ruleset, uniqueIdentifier, (r: RegisteredRuleset) => managerMock.object(r));
      registered[Symbol.dispose]();
      managerMock.verify((x) => x(registered), moq.Times.once());
    });
  });
});
