/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ITwinLocalization } from "@itwin/core-i18n";

describe("Localization tests", () => {
  it("registers I18N namespaces", async () => {
    const i18n = new ITwinLocalization();

    await i18n.registerNamespace("namespace1");
    await i18n.registerNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isDefined(i18n.getNamespace("namespace2"));

    i18n.unregisterNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isUndefined(i18n.getNamespace("namespace2"));

    await i18n.registerNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isDefined(i18n.getNamespace("namespace2"));
  });
});
