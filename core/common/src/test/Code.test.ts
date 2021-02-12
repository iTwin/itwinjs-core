/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, CodeProps } from "../Code";

describe.only("Code", () => {
  const spec = "0x1";
  const scope = "0x1";

  it("constructor should trim leading and trailing whitespace", () => {
    const value = "Value";
    assert.equal(value, new Code({ spec, scope, value }).value);
    assert.equal(value, new Code({ spec, scope, value: " Value" }).value);
    assert.equal(value, new Code({ spec, scope, value: "Value " }).value);
    assert.equal(value, new Code({ spec, scope, value: " Value " }).value);
    assert.equal(value, new Code({ spec, scope, value: "\tValue" }).value);
    assert.equal(value, new Code({ spec, scope, value: "Value\t" }).value);
    assert.equal(value, new Code({ spec, scope, value: "\tValue\t" }).value);
    assert.equal(value, new Code({ spec, scope, value: "\nValue" }).value);
    assert.equal(value, new Code({ spec, scope, value: "Value\n" }).value);
    assert.equal(value, new Code({ spec, scope, value: "\nValue\n" }).value);
    assert.equal(value, new Code({ spec, scope, value: "  \t\n  Value  \n\t  " }).value);
    assert.isTrue(Code.equalCodes(new Code({ spec, scope, value: "  \t\n  Value  \n\t  " }), new Code({ spec, scope, value: " Value " })));
  });

  it("empty Code should be valid", () => {
    const emptyCode = Code.createEmpty();
    assert.isTrue(Code.isValid(emptyCode));
    assert.isTrue(Code.isEmpty(emptyCode));

    const undefinedValue: CodeProps = { spec, scope };
    assert.isTrue(Code.isValid(undefinedValue));
    assert.isTrue(Code.isEmpty(undefinedValue));
    assert.equal(new Code(undefinedValue).getValue(), "");
    assert.equal(new Code(undefinedValue).value, "");

    const fromUndefined = Code.fromJSON();
    assert.isTrue(Code.isValid(fromUndefined));
    assert.isTrue(Code.isEmpty(fromUndefined));

    const fromEmpty = Code.fromJSON(Code.createEmpty());
    assert.isTrue(Code.isValid(fromEmpty));
    assert.isTrue(Code.isEmpty(fromEmpty));

    const fromWhitespace = new Code({ spec, scope, value: "  \t\n  "});
    assert.isTrue(Code.isValid(fromWhitespace));
    assert.isTrue(Code.isEmpty(fromWhitespace));
    assert.equal(fromWhitespace.getValue(), "");
    assert.equal(fromWhitespace.value, "");
  });
});
