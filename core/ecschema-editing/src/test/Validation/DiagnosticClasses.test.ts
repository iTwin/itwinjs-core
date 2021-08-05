/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Diagnostics as ECDiagnostics } from "../../Validation/ECRules";

describe("DiagnosticClasses tests", () => {
  function getMessageArgsHolders(text: string): string[] {
    const holders: string[] = [];
    const matches = text.match(/{(\d+)}/g);
    if (!matches)
      return holders;

    for (const match of matches) {
      if (holders.includes(match.charAt(1)))
        continue;
      holders.push(match.charAt(1));
    }
    holders.sort();
    return holders;
  }

  it("EC Diagnostic messages have valid arg place holders.", async () => {
    for (const [key, value] of Object.entries(ECDiagnostics)) {
      const params = getMessageArgsHolders(value.prototype.messageText);
      let index = 0;
      for (const param of params) {
        expect(param, `Diagnostic ${key} has invalid message arguments`).to.equal(index.toString());
        index++;
      }
    }
  });
});
