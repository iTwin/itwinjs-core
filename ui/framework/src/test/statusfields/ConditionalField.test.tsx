/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { FooterSeparator } from "@bentley/ui-ninezone";
import { ConditionalField, StatusFieldProps } from "../../ui-framework";

describe("ConditionalField", () => {

  it("should mount with isInFooterMode", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
        {(isInFooterMode: boolean) => isInFooterMode && <FooterSeparator />}
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
    wrapper.unmount();
  });

  it("should mount with isInFooterMode=false", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={false} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
        {(isInFooterMode: boolean) => isInFooterMode && <FooterSeparator />}
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
    wrapper.unmount();
  });

  it("should mount with children", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} defaultValue={false} >
        <FooterSeparator />
      </ConditionalField>);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
    wrapper.unmount();
  });

  it("should mount with no children", () => {
    const wrapper = mount(
      <ConditionalField isInFooterMode={true} onOpenWidget={() => { }} openWidget="test"
        boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
      </ConditionalField>);
    wrapper.unmount();
  });
});
