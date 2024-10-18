/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface } from "../RpcInterface";
import { describe, expect, it } from "vitest";

describe("isVersionCompatible", () => {
  it("pass when versions match exactly with prerelease tags", () => {
    expect(RpcInterface.isVersionCompatible("3.0.0-dev.0", "3.0.0-dev.0")).to.equal(true);
  });
  it("fail when versions with different prerelease tags", () => {
    expect(RpcInterface.isVersionCompatible("3.0.0-dev.0", "3.0.0-dev.1")).to.equal(false);
  });
  it("fail when versions match but one has prerelease tags", () => {
    expect(RpcInterface.isVersionCompatible("3.0.0", "3.0.0-dev.1")).to.equal(false);
  });
  it("pass when major versions are 0 and backend patch is greater", () => {
    expect(RpcInterface.isVersionCompatible("0.11.1", "0.11.0")).to.equal(true);
  });
  it("fail when major versions are 0 and frontend patch is greater", () => {
    expect(RpcInterface.isVersionCompatible("0.11.0", "0.11.1")).to.equal(false);
  });
  it("pass when versions match exactly without prerelease tags", () => {
    expect(RpcInterface.isVersionCompatible("3.0.0", "3.0.0")).to.equal(true);
  });
  it("fail when major versions are different", () => {
    expect(RpcInterface.isVersionCompatible("4.0.0", "3.0.0")).to.equal(false);
  });
  it("pass when major versions match, backend minor version is greater", () => {
    expect(RpcInterface.isVersionCompatible("3.2.0", "3.1.0")).to.equal(true);
  });
  it("fail when major versions match, frontend minor version is greater", () => {
    expect(RpcInterface.isVersionCompatible("3.1.0", "3.2.0")).to.equal(false);
  });
  it("fail when random string is passed in", () => {
    expect(RpcInterface.isVersionCompatible("3.1.0", "kashfakfbjkafk")).to.equal(false);
  });
});
