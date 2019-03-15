/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";

import { RgbColor, LinePixels } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../../render/FeatureSymbology";

describe("FeatureSymbology.Appearance", () => {
  it("default constructor works as expected", () => {
    const app = FeatureSymbology.Appearance.fromJSON();
    assert.isUndefined(app.rgb);
    assert.isUndefined(app.weight);
    assert.isUndefined(app.transparency);
    assert.isUndefined(app.linePixels);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("AppearanceProps passed in constructor works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(100, 100, 100), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code2 } as FeatureSymbology.AppearanceProps;
    let app = FeatureSymbology.Appearance.fromJSON(props1);
    assert.isTrue(app.overridesRgb);
    assert.isTrue(app.overridesWeight);
    assert.isTrue(app.overridesTransparency);
    assert.isTrue(app.overridesLinePixels);
    assert.isTrue(app.ignoresMaterial);

    app = FeatureSymbology.Appearance.fromJSON(props2);
    assert.isUndefined(app.ignoresMaterial);
  });

  it("extend works as expected", () => {
    const props1 = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true } as FeatureSymbology.AppearanceProps;
    const props2 = { rgb: new RgbColor(250, 180, 150), weight: 1, transparency: 200 / 255, linePixels: LinePixels.Code3 } as FeatureSymbology.AppearanceProps;
    const expectedProps = { rgb: new RgbColor(100, 100, 100), linePixels: LinePixels.Code2, ignoresMaterial: true, weight: 1, transparency: 200 / 255 } as FeatureSymbology.AppearanceProps;
    let app1 = FeatureSymbology.Appearance.fromJSON(props1);
    const app2 = FeatureSymbology.Appearance.fromJSON(props2);
    app1 = app2.extendAppearance(app1);
    const expected = FeatureSymbology.Appearance.fromJSON(expectedProps);
    assert.isTrue(expected.equals(app1));
  });
});
