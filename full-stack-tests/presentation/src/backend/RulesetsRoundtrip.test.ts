/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { using } from "@bentley/bentleyjs-core";
import { PresentationManagerMode } from "@bentley/presentation-backend";
import { createDefaultNativePlatform, NativePlatformDefinition } from "@bentley/presentation-backend/lib/presentation-backend/NativePlatform";
import { RulesetManagerImpl } from "@bentley/presentation-backend/lib/presentation-backend/RulesetManager";
import { Ruleset } from "@bentley/presentation-common";
import { createRandomRuleset } from "@bentley/presentation-common/lib/test/_helpers/random";
import { initialize, terminate } from "../IntegrationTests";
import { tweakRuleset } from "./Helpers";

describe("Rulesets roundtrip", () => {

  let nativePlatform: NativePlatformDefinition;
  let rulesets: RulesetManagerImpl;

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

    rulesets = new RulesetManagerImpl(() => nativePlatform);
  });

  after(async () => {
    nativePlatform.dispose();
    await terminate();
  });

  const getRoundtripRuleset = async (sourceRuleset: Ruleset): Promise<Ruleset> => {
    const registered = rulesets.get(sourceRuleset.id);
    if (!registered)
      throw new Error(`Did not find a registered ruleset with id ${sourceRuleset.id}`);
    const roundtripRuleset = registered.toJSON();
    tweakRuleset(sourceRuleset as any, roundtripRuleset);
    return roundtripRuleset;
  };

  for (let i = 0; i < 10; ++i) {
    it(`ruleset stays the same after roundtrip to/from native platform ${i + 1}`, async () => {
      const sourceRuleset: Ruleset = await createRandomRuleset();
      try {
        await using(rulesets.add(sourceRuleset), async (_r) => {
          const afterRoundtripRuleset = await getRoundtripRuleset(sourceRuleset);
          expect(afterRoundtripRuleset).to.deep.equal(sourceRuleset,
            `Before: \r\n${JSON.stringify(sourceRuleset)} \r\nAfter: \r\n${JSON.stringify(afterRoundtripRuleset)}`);
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`Threw with:\r\n${JSON.stringify(sourceRuleset)}`);
        throw e;
      }
    });
  }

});
