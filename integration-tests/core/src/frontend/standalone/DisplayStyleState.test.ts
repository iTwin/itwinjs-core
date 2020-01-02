/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect } from "chai";
import { Vector3d } from "@bentley/geometry-core";
import {
  DisplayStyle3dProps,
} from "@bentley/imodeljs-common";
import {
  DisplayStyle3dState,
  IModelConnection,
  MockRender,
} from "@bentley/imodeljs-frontend";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");

describe("DisplayStyle", () => {
  let imodel: IModelConnection;
  const styleProps: DisplayStyle3dProps = {
    classFullName: "bis.DisplayStyle3d",
    model: "0",
    code: {
      spec: "0x1",
      scope: "0x1",
      value: "",
    },
  };

  before(async () => {
    MockRender.App.startup();
    imodel = await IModelConnection.openSnapshot(iModelLocation);
  });

  after(async () => {
    if (imodel)
      await imodel.closeSnapshot();

    MockRender.App.shutdown();
  });

  it("should clone correctly", () => {
    const style1 = new DisplayStyle3dState(styleProps, imodel);
    const style2 = style1.clone(imodel);
    expect(JSON.stringify(style1)).to.equal(JSON.stringify(style2));

      // ###TODO More substantial tests (change style properties)
  });

  it("should preserve sun direction", () => {
    const style1 = new DisplayStyle3dState(styleProps, imodel);
    expect(style1.sunDirection).to.be.undefined;

    style1.setSunTime(Date.now());
    expect(style1.sunDirection).not.to.be.undefined;

    const style2 = style1.clone(imodel);
    expect(style2.sunDirection).not.to.be.undefined;
    expect(style2.sunDirection!.isAlmostEqual(style1.sunDirection!)).to.be.true;
  });

  it("should read sun direction from json", () => {
    const props = { ...styleProps };
    const sunDir = new Vector3d(1, 0, 0.5);
    props.jsonProperties = { styles: { sceneLights: { sunDir } } };

    const style = new DisplayStyle3dState(props, imodel);
    expect(style.sunDirection).not.to.be.undefined;
    expect(style.sunDirection!.x).to.equal(sunDir.x);
    expect(style.sunDirection!.y).to.equal(sunDir.y);
    expect(style.sunDirection!.z).to.equal(sunDir.z);
  });
});
