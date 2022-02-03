/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import type { StatusFieldProps } from "../../appui-react";
import { ConditionalField } from "../../appui-react";
import { mount } from "../TestUtils";

describe("ConditionalField", () => {

  it("should mount with isInFooterMode", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
        {(isInFooterMode: boolean) => isInFooterMode && <FooterSeparator />}
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
  });

  it("should mount with isInFooterMode=false", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={false} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
        {(isInFooterMode: boolean) => isInFooterMode && <FooterSeparator />}
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
  });

  it("should mount with children", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} defaultValue={false} >
        <FooterSeparator />
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
  });

  it("should mount with no children", () => {
    mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
      </ConditionalField>);
  });
});
