/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { I18N } from "../Localization";

describe("ITwinLocalization tests", () => {
  it("registers ITwinLocalization namespaces", async () => {
    const i18n = new I18N(["namespace1", "namespace2"]);
    assert.strictEqual((i18n as any)._namespaceRegistry.size, 2);
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isDefined(i18n.getNamespace("namespace2"));

    i18n.unregisterNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isUndefined(i18n.getNamespace("namespace2"));

    // await i18n.registerNamespace("namespace2");
    // assert.isDefined(i18n.getNamespace("namespace1"));
    // assert.isDefined(i18n.getNamespace("namespace2"));
  });
});
