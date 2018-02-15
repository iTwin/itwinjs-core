/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { ModelSelectorState } from "../../frontend/ModelSelectorState";
import { IModelConnection } from "../../frontend/IModelConnection";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Code } from "../../common/Code";
import { ModelSelectorProps } from "../../common/ElementProps";

const iModelLocation = path.join(__dirname, "../../../../backend/lib/backend/test/assets/CompatibilityTestSeed.bim");

describe("ModelState", () => {
  let imodel: IModelConnection;
  before(async () => { imodel = await IModelConnection.openStandalone(iModelLocation); });
  after(async () => { if (imodel) imodel.closeStandalone(); });

  it("Model Selectors should hold models", () => {
    const props: ModelSelectorProps = {
      classFullName: ModelSelectorState.getClassFullName(),
      model: new Id64([1, 1]),
      code: Code.createEmpty(),
      id: new Id64(),
      models: ["0x1"],
    };

    const selector = new ModelSelectorState(props, imodel);
    selector.addModels([new Id64([2, 1]), new Id64([2, 1]), new Id64([2, 3])]);
    assert.equal(selector.models.size, 3);
    const out = selector.toJSON();
    assert.isArray(out.models);
    assert.equal(out.models.length, 3);
    out.iModel = imodel;
    const sel3 = selector.clone();
    assert.deepEqual(sel3, selector, "clone worked");
  });

  it("should be able to load ModelState", async () => {
    const model2d = await imodel.models.getModelProps("0x24");
    assert.equal(model2d.length, 1);
  });

});
