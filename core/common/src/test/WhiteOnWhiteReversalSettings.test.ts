/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { WhiteOnWhiteReversalProps} from "../WhiteOnWhiteReversalSettings";
import { WhiteOnWhiteReversalSettings } from "../WhiteOnWhiteReversalSettings";

describe("WhiteOnWhiteReversalSettings", () => {
  it("round-trips through JSON", () => {
    function test(props?: WhiteOnWhiteReversalProps, expected?: WhiteOnWhiteReversalProps | "input"): void {
      const settings = WhiteOnWhiteReversalSettings.fromJSON(props);
      const actual = settings.toJSON();
      expect(actual).to.deep.equal("input" === expected ? props : expected);
    }

    test(undefined, undefined);
    test({ ignoreBackgroundColor: true }, "input");
    test({ ignoreBackgroundColor: false }, undefined);
  });

  it("compares", () => {
    function test(expectEqual: boolean, x: WhiteOnWhiteReversalSettings, y: WhiteOnWhiteReversalSettings): void {
      expect(x.equals(y)).to.equal(expectEqual);
      expect(x === y).to.equal(expectEqual);
    }

    const a = WhiteOnWhiteReversalSettings.fromJSON();
    const b = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor: false });
    const c = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor: true });
    const d = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor: true });

    test(true, a, b);
    test(true, c, d);
    test(false, a, c);
    test(false, d, b);
  });
});
