/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BentleyCloudRpcProtocol, IModelRpcProps, RpcConfiguration, RpcInvocation } from "../core-common";

describe("RpcInvocation token policy", () => {
  const iTwinId = "1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a";
  const iModelId = "2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b";
  const changesetId = "0123456789abcdef0123456789abcdef01234567";
  const otherIModelId = "3c3c3c3c-3c3c-3c3c-3c3c-3c3c3c3c3c3c";
  const otherChangesetId = "fedcba9876543210fedcba9876543210fedcba98";
  const path = `/app/v1/mode/1/context/${iTwinId}/imodel/${iModelId}/changeset/${changesetId}/IModelTileRpcInterface-3.2.0-getTileCacheConfig`;

  const urlToken: IModelRpcProps = { key: `${iModelId}:${changesetId}`, iTwinId, iModelId, changeset: { id: changesetId, index: undefined } };

  let warningSpy: ReturnType<typeof vi.spyOn>;
  const throwOnTokenMismatch = RpcConfiguration.throwOnTokenMismatch;

  beforeEach(() => {
    warningSpy = vi.spyOn(Logger, "logWarning").mockImplementation(() => { });
  });

  afterEach(() => {
    RpcConfiguration.throwOnTokenMismatch = throwOnTokenMismatch;
    vi.restoreAllMocks();
  });

  /** Apply the invocation's token policies to `parameters` (in place), as if received by a BentleyCloudRpcProtocol at `path`. */
  function applyPolicies(parameters: any[], opts?: { checkToken?: boolean, allowTokenMismatch?: boolean }): any[] {
    const invocation = Object.create(RpcInvocation.prototype);
    invocation.protocol = {
      checkToken: opts?.checkToken ?? true,
      inflateToken: (token: IModelRpcProps, request: any) => BentleyCloudRpcProtocol.prototype.inflateToken.call(undefined, token, request),
    };
    invocation.operation = { policy: { allowTokenMismatch: opts?.allowTokenMismatch ?? false } };
    invocation.request = { path };
    invocation.applyPolicies(parameters);
    return parameters;
  }

  it("leaves a token matching the URL unchanged", () => {
    const [token] = applyPolicies([{ ...urlToken }]);
    expect(token).to.deep.equal(urlToken);
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("replaces a token's iModelId with the URL's, even if iTwinId is omitted", () => {
    const [token] = applyPolicies([{ key: `${iModelId}:${changesetId}`, iModelId: otherIModelId, changeset: { id: otherChangesetId } }]);
    expect(token.iModelId).to.equal(iModelId);
    expect(token.iTwinId).to.equal(iTwinId);
    expect(token.changeset.id).to.equal(changesetId);
    expect(warningSpy).toHaveBeenCalledOnce();
  });

  it("replaces a token's key with the URL's, even if iModelId and iTwinId are omitted", () => {
    const [token] = applyPolicies([{ key: `${otherIModelId}:${otherChangesetId}` }]);
    expect(token).to.deep.equal(urlToken);
    expect(warningSpy).toHaveBeenCalledOnce();
  });

  it("replaces a token's iModelId with the URL's, even if key and iTwinId are omitted", () => {
    const [token] = applyPolicies([{ iModelId: otherIModelId }]);
    expect(token.iModelId).to.equal(iModelId);
    expect(token.key).to.equal(urlToken.key);
  });

  it("does not report a mismatch if a token omits only iTwinId", () => {
    const [token] = applyPolicies([{ key: urlToken.key, iModelId, changeset: { id: changesetId } }]);
    expect(token).to.deep.equal(urlToken);
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("throws on a mismatched token that omits iTwinId if throwOnTokenMismatch is set", () => {
    RpcConfiguration.throwOnTokenMismatch = true;
    expect(() => applyPolicies([{ key: urlToken.key, iModelId: otherIModelId }])).to.throw("IModelRpcProps mismatch detected for this request.");
  });

  it("does not treat subsequent parameters as tokens unless they have both iModelId and iTwinId", () => {
    // e.g. PresentationRpcInterface.getDisplayLabelDefinition's options include `key: InstanceKey`
    const options = { key: { className: "BisCore:Element", id: "0x1" }, rulesetOrId: "x" };
    const partial = { iModelId: otherIModelId };
    const [token, opts, other] = applyPolicies([{ ...urlToken }, { ...options }, { ...partial }]);
    expect(token).to.deep.equal(urlToken);
    expect(opts).to.deep.equal(options);
    expect(other).to.deep.equal(partial);
  });

  it("still treats any parameter with both iModelId and iTwinId as a token", () => {
    const [, token] = applyPolicies(["first", { iTwinId, iModelId: otherIModelId }]);
    expect(token.iModelId).to.equal(iModelId);
  });

  it("ignores non-object first parameters", () => {
    const params = applyPolicies(["C:\\some\\file.bim", undefined]);
    expect(params).to.deep.equal(["C:\\some\\file.bim", undefined]);
    expect(applyPolicies([null])).to.deep.equal([null]);
    expect(applyPolicies([[{ key: "a:b" }]])).to.deep.equal([[{ key: "a:b" }]]);
  });

  it("does not modify tokens if the protocol does not check tokens", () => {
    const original = { key: `${otherIModelId}:${otherChangesetId}`, iModelId: otherIModelId };
    const [token] = applyPolicies([{ ...original }], { checkToken: false });
    expect(token).to.deep.equal(original);
  });

  it("does not modify tokens if the operation allows token mismatch", () => {
    const original = { key: `${otherIModelId}:${otherChangesetId}`, iModelId: otherIModelId };
    const [token] = applyPolicies([{ ...original }], { allowTokenMismatch: true });
    expect(token).to.deep.equal(original);
  });
});
