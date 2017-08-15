/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel } from "../IModel";
// import { Element } from "../Element";
import { Elements } from "../Elements";
import { ElementPropertyFormatter } from "../ElementPropertyFormatter";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";

// First, register any schemas that will be used in the tests.
BisCore.registerSchema();

describe("ElementPropertyFormatter", () => {

  it("should format", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const elements: Elements = imodel.elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const {result: el} = await elements.getElement({ code: code1 });
    if (undefined === el)
      throw new Error();
    const formatter: ElementPropertyFormatter = new ElementPropertyFormatter(imodel);
    const { result: props } = await formatter.formatProperties(el);
    assert.isArray(props);
    assert.notEqual(props.length, 0);
    const item = props[0];
    assert.isString(item.category);
    assert.isArray(item.properties);
  });
});
