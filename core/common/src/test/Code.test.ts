/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, CodeProps } from "../Code";

describe("Code", () => {
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
    assert.equal(new Code(undefinedValue).value, "");
    assert.isTrue(Code.equalCodes(new Code(undefinedValue), emptyCode));

    const fromUndefined = Code.fromJSON();
    assert.isTrue(Code.isValid(fromUndefined));
    assert.isTrue(Code.isEmpty(fromUndefined));
    assert.isTrue(Code.equalCodes(fromUndefined, emptyCode));

    const fromEmpty = Code.fromJSON(Code.createEmpty());
    assert.isTrue(Code.isValid(fromEmpty));
    assert.isTrue(Code.isEmpty(fromEmpty));
    assert.isTrue(Code.equalCodes(fromEmpty, emptyCode));

    const fromWhitespace = new Code({ spec, scope, value: "  \t\n  " });
    assert.isTrue(Code.isValid(fromWhitespace));
    assert.isTrue(Code.isEmpty(fromWhitespace));
    assert.equal(fromWhitespace.value, "");
    assert.isTrue(Code.equalCodes(fromWhitespace, emptyCode));
  });

  it("should set and clear Code value", () => {
    const value = "Value";
    const code = new Code({ spec, scope, value });
    assert.isTrue(Code.isValid(code));
    assert.equal(value, code.value);

    const newValue = "NewValue";
    code.value = newValue;
    assert.isTrue(Code.isValid(code));
    assert.equal(newValue, code.value);

    code.value = "  \t\n  Value  \t\n  ";
    assert.isTrue(Code.isValid(code));
    assert.equal(value, code.value);

    code.value = "";
    assert.isTrue(Code.isValid(code));
    assert.isTrue(Code.isEmpty(code));

    (code as any).value = undefined;
    assert.isTrue(Code.isValid(code));
    assert.isTrue(Code.isEmpty(code));
    assert.equal(code.value, "");
  });

  it("should roundtrip through JSON", () => {
    const code = new Code({ spec, scope, value: "Value" });
    const codeFromJson = new Code(JSON.parse(JSON.stringify(code)));
    assert.isTrue(Code.equalCodes(code, codeFromJson));
  });
});
