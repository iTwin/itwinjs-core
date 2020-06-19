/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { I18N } from "@bentley/imodeljs-i18n";

describe("Localization tests", () => {
  it("registers I18N namespaces", () => {
    const i18n = new I18N(["namespace1", "namespace2"]);
    assert.strictEqual((i18n as any)._namespaceRegistry.size, 2);
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isDefined(i18n.getNamespace("namespace2"));

    i18n.unregisterNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isUndefined(i18n.getNamespace("namespace2"));

    i18n.registerNamespace("namespace2");
    assert.isDefined(i18n.getNamespace("namespace1"));
    assert.isDefined(i18n.getNamespace("namespace2"));
  });
});
