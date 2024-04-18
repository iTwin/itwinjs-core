/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TextStyleSettings, TextStyleSettingsProps } from "../../core-common";

describe("TextStyleSettings", () => {
  const customProps: Required<TextStyleSettingsProps> = {
    color: 0xff007f,
    fontName: "customFont",
    lineHeight: 2,
    lineSpacingFactor: 1,
    isBold: true,
    isItalic: true,
    isUnderlined: true,
    stackedFractionScale: 0.8,
    stackedFractionType: "diagonal",
    subScriptOffsetFactor: -0.2,
    subScriptScale: 0.5,
    superScriptOffsetFactor: 0.6,
    superScriptScale: 0.5,
    widthFactor: 2,
  };

  it("returns defaults if no props provided", () => {
    expect(TextStyleSettings.fromJSON()).to.equal(TextStyleSettings.defaults);
    expect(TextStyleSettings.fromJSON({})).not.to.equal(TextStyleSettings.defaults);
  });

  it("round-trips through JSON", () => {
    expect(TextStyleSettings.defaults.toJSON()).to.deep.equal(TextStyleSettings.defaultProps);
    expect(TextStyleSettings.fromJSON({}).toJSON()).to.deep.equal(TextStyleSettings.defaultProps);

    expect(TextStyleSettings.fromJSON(customProps).toJSON()).to.deep.equal(customProps);
  });

  it("compares for equality", () => {
    expect(TextStyleSettings.fromJSON({}).equals(TextStyleSettings.defaults)).to.be.true;

    for (const propName of Object.keys(customProps)) {
      const key = propName as keyof TextStyleSettingsProps;
      const props: TextStyleSettingsProps = { };
      (props as any)[key] = customProps[key];

      const settings = TextStyleSettings.fromJSON(props);
      expect(settings.equals(TextStyleSettings.defaults)).to.be.false;
    }

    expect(TextStyleSettings.fromJSON(customProps).equals(TextStyleSettings.fromJSON(customProps))).to.be.true;
  });
});
