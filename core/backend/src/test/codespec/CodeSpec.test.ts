/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { StandaloneDb } from "../../IModelDb";

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

    imodel.saveChanges();
    expect(Id64.isValidId64(codeSpecId)).to.be.true;
    expect(codeSpecId).to.be.equal(codeSpec.id);

    codeSpec = imodel.codeSpecs.getById(codeSpecId);

    expect(codeSpec.scopeReq).to.be.equal(CodeScopeSpec.ScopeRequirement.ElementId);
    expect(codeSpec.scopeType).to.be.equal(CodeScopeSpec.Type.Model);

    codeSpec.scopeReq = CodeScopeSpec.ScopeRequirement.FederationGuid;
    codeSpec.scopeType = CodeScopeSpec.Type.Repository;
    imodel.codeSpecs.updateProperties(codeSpec);
    imodel.saveChanges();
    const fname = imodel.pathName;
    imodel.close();
    imodel = StandaloneDb.openFile(fname);

    codeSpec = imodel.codeSpecs.getByName("PumpTag");
    expect(codeSpecId).to.be.equal(codeSpec.id);

    expect(codeSpec.scopeReq).to.be.equal(CodeScopeSpec.ScopeRequirement.FederationGuid);
    expect(codeSpec.scopeType).to.be.equal(CodeScopeSpec.Type.Repository);

    codeSpec = imodel.codeSpecs.getById(codeSpecId);
    expect(codeSpec.name).to.be.equal("PumpTag");
  });
});
