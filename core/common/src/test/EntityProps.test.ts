/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { EntityProps, isPersisted } from "../EntityProps";

describe("isPersisted", () => {
  const props: EntityProps = { classFullName: "BisCore:Element" };

  it("returns false when the id is missing", () => {
    expect(isPersisted(props)).to.be.false;
  });

  it("returns false when the id is 0", () => {
    expect(isPersisted({ ...props, id: "0" })).to.be.false;
  });

  it("returns false when the id is malformed", () => {
    expect(isPersisted({ ...props, id: "not-an-id" })).to.be.false;
  });

  it("returns true when the id is valid", () => {
    expect(isPersisted({ ...props, id: "0x1" })).to.be.true;
  });
});
