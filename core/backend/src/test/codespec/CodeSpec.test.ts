/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, CodeSpecKind } from "@itwin/core-common";
import {
  IModelDb, StandaloneDb,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("CodeSpec", () => {
  let imodel: StandaloneDb;
  before(() => {
    imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("CodeSpec", "CodeSpec.bim"), {
      rootSubject: { name: "CodeSpec tests", description: "CodeSpec tests" },
      client: "CodeSpec",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });

  after(() => {
    imodel.close();
  });

  it("should insert with default properties and update them later", () => {
    let codeSpec = CodeSpec.create(imodel, "PumpTag", CodeScopeSpec.Type.Model);
    const codeSpecId = imodel.codeSpecs.insert(codeSpec);

    expect(Id64.isValidId64(codeSpecId)).to.be.true;
    expect(codeSpecId).to.be.equal(codeSpec.id);

    codeSpec = imodel.codeSpecs.getById(codeSpecId);

    expect(codeSpec.codeSpecKind).to.be.equal(CodeSpecKind.RepositorySpecific);
    expect(codeSpec.scopeType).to.be.equal(CodeScopeSpec.Type.Model);
    expect(codeSpec.scopeReq).to.be.equal(CodeScopeSpec.ScopeRequirement.ElementId);

    codeSpec.codeSpecKind = CodeSpecKind.BusinessRelated;
    codeSpec.scopeReq = CodeScopeSpec.ScopeRequirement.FederationGuid;
    codeSpec.scopeType = CodeScopeSpec.Type.Repository;
    imodel.codeSpecs.update(codeSpec);

    codeSpec = imodel.codeSpecs.getByName("PumpTag");
    expect(codeSpecId).to.be.equal(codeSpec.id);

    expect(codeSpec.codeSpecKind).to.be.equal(CodeSpecKind.BusinessRelated);
    expect(codeSpec.scopeType).to.be.equal(CodeScopeSpec.Type.Repository);
    expect(codeSpec.scopeReq).to.be.equal(CodeScopeSpec.ScopeRequirement.FederationGuid);

    codeSpec = imodel.codeSpecs.getById(codeSpecId);
    expect(codeSpec.name).to.be.equal("PumpTag");
  });
});
