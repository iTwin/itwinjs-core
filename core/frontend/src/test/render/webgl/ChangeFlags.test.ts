/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ChangeFlag, ChangeFlags } from "../../../ChangeFlags";

describe("ChangeFlags", () => {
  it("should behave as expected", () => {
    const f = new ChangeFlags();
    expect(f.hasChanges).to.be.true;
    expect(f.value).to.equal(ChangeFlag.Initial);
    expect(f.areFeatureOverridesDirty).to.be.true;
    expect(f.isSet(ChangeFlag.Initial)).to.be.true;
    expect(f.isSet(ChangeFlag.All)).to.be.true;
    expect(f.areAllSet(ChangeFlag.Initial)).to.be.true;
    expect(f.areAllSet(ChangeFlag.All)).to.be.false;
    expect(f.isSet(ChangeFlag.AlwaysDrawn)).to.be.false;
    expect(f.isSet(ChangeFlag.ViewedCategories)).to.be.true;

    const f1 = new ChangeFlags(ChangeFlag.All);
    expect(f1.hasChanges).to.be.true;
    expect(f1.value).to.equal(ChangeFlag.All);
    expect(f1.areFeatureOverridesDirty).to.be.true;
    expect(f1.isSet(ChangeFlag.All)).to.be.true;
    expect(f1.isSet(ChangeFlag.AlwaysDrawn)).to.be.true;
    expect(f1.areAllSet(ChangeFlag.All)).to.be.true;

    f1.clear();
    expect(f1.hasChanges).to.be.false;
    expect(f1.value).to.equal(0);
    expect(f1.areFeatureOverridesDirty).to.be.false;

    f1.setViewedModels();
    expect(f1.hasChanges).to.be.true;
    expect(f1.areFeatureOverridesDirty).to.be.false;
    expect(f1.areAllSet(ChangeFlag.ViewedModels)).to.be.true;

    f1.setDisplayStyle();
    expect(f1.areFeatureOverridesDirty).to.be.true;
  });
});
