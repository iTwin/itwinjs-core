/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ColorDef, TextStyleSettings, TextStyleSettingsProps } from "../../core-common";
import { DeepRequiredObject } from "@itwin/core-bentley";

describe("TextStyleSettings", () => {
  const customProps: DeepRequiredObject<TextStyleSettingsProps> = {
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
    frame: {
      shape: "rectangle",
      fill: ColorDef.green.tbgr,
      border: ColorDef.red.tbgr,
      borderWeight: 2,
    },
    leader: {
      color: 0xff007f,
      wantElbow: false,
      elbowLength: 0.5,
      terminatorHeightFactor: 0.5,
      terminatorWidthFactor: 0.5,
    },
    tabInterval: 7,
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
      const props: TextStyleSettingsProps = {};
      (props as any)[key] = customProps[key];

      const settings = TextStyleSettings.fromJSON(props);
      expect(settings.equals(TextStyleSettings.defaults)).to.be.false;
    }

    expect(TextStyleSettings.fromJSON(customProps).equals(TextStyleSettings.fromJSON(customProps))).to.be.true;
  });

  it("returns validation error messages for invalid values", () => {
    const validSettings = TextStyleSettings.fromJSON(customProps);
    expect(validSettings.getValidationErrors()).to.be.empty;

    const invalidSettings = validSettings.clone({
      fontName: "",
      lineHeight: 0,
      stackedFractionScale: 0,
    });

    const errors = invalidSettings.getValidationErrors();
    expect(errors).to.include("fontName must be provided");
    expect(errors).to.include("lineHeight must be greater than 0");
    expect(errors).to.include("stackedFractionScale must be greater than 0");
  });
});
