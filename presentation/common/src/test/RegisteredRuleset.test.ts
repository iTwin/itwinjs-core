/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { RegisteredRuleset, Ruleset, RuleTypes } from "../presentation-common.js";

describe("RegisteredRuleset", () => {
  let uniqueIdentifier: string;
  let disposeSpy: sinon.SinonSpy;

  beforeEach(() => {
    disposeSpy = sinon.spy();
    uniqueIdentifier = "unique-id";
  });

  afterEach(() => {
    sinon.restore();
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
      registered = new RegisteredRuleset(ruleset, uniqueIdentifier, disposeSpy);
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
      const registered = new RegisteredRuleset(ruleset, uniqueIdentifier, disposeSpy);
      registered[Symbol.dispose]();
      sinon.assert.calledOnceWithExactly(disposeSpy, registered);
    });
  });
});
