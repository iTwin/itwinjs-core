/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as enzyme from "enzyme";
import TestUtils from "../TestUtils";
import InputFieldMessage from "../../src/messages/InputField";

describe("InputFieldMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render correctly", () => {
    enzyme.shallow(
      <InputFieldMessage
        target={document.activeElement as HTMLElement}
        children={<div />}
        onClose={() => { }}
      />,
    ).should.matchSnapshot();
  });

  it("should unmount correctly", () => {
    const sut = enzyme.mount(
      <InputFieldMessage
        target={document.activeElement as HTMLElement}
        children={<div />}
        onClose={() => { }}
      />,
    );
    sut.unmount();
  });
});
