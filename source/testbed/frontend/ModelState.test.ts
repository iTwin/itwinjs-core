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
import { DrawingModelState, SheetModelState, SpatialModelState } from "../../frontend/ModelState";

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
    const modelStates = await imodel.models.loadModels(["0x24", "0x28", "0x2c", "0x11", "0x34", "0x24", "nonsense"]);
    assert.equal(modelStates.length, 5);
    assert.instanceOf(modelStates[0], DrawingModelState);
    assert.instanceOf(modelStates[1], SheetModelState);
    assert.instanceOf(modelStates[2], DrawingModelState);
    assert.instanceOf(modelStates[3], SpatialModelState);
    assert.instanceOf(modelStates[4], DrawingModelState);
    modelStates.forEach((model) => assert.deepEqual(model.clone(), model, "clone of ModelState should work"));

    const modelProps = await imodel.models.queryModelProps({ from: SpatialModelState.sqlName });
    assert.isAtLeast(modelProps.length, 2);
  });

});
