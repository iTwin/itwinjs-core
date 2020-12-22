/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FunctionChain } from "../FunctionChain";

describe("FunctionChain", () => {
  let str = "";
  function concat(s: string): () => void {
    return () => {
      str = `${str}${s}`;
    };
  }

  it("executes in specified sequence", () => {
    str = "";
    let chain = new FunctionChain(concat("a"));
    chain.call();
    expect(str).to.equal("a");

    str = "";
    chain = new FunctionChain(concat("c"));
    chain.append(concat("d"));
    chain.prepend(concat("b"));
    chain.prepend(concat("a"));
    chain.append(concat("e"));

    chain.call();
    expect(str).to.equal("abcde");
  });

  it("defers functions added during call", () => {
    str = "";
    const chain = new FunctionChain();
    chain.append(() => {
      chain.prepend(concat("x"));
      concat("y")();
      chain.append(concat("z"));
    });

    chain.call();
    expect(str).to.equal("y");

    str = "";
    chain.call();
    expect(str).to.equal("xyz");
  });

  it("ignores functions added during callAndClear", () => {
    str = "";
    const chain = new FunctionChain();
    chain.prepend(() => {
      chain.prepend(concat("x"));
      concat("y")();
      chain.append(concat("z"));
    });

    chain.callAndClear();
    expect(str).to.equal("y");

    str = "";
    chain.call();
    expect(str).to.equal("");
  });

  it("clears", () => {
    str = "";
    const chain = new FunctionChain(concat("never"));
    chain.clear();
    chain.call();
    expect(str).to.equal("");
  });

  it("calls and clears", () => {
    str = "";
    const chain = new FunctionChain(concat("once"));
    chain.callAndClear();
    expect(str).to.equal("once");

    str = "";
    chain.call();
    expect(str).to.equal("");
  });
});
