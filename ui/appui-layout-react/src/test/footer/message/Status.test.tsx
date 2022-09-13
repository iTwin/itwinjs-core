/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MessageSeverity } from "@itwin/appui-abstract";
import { Status, StatusHelpers } from "../../../appui-layout-react";

describe("<StatusHelpers />", () => {
  it("should return information class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Information);
    sut.should.eq("nz-status-information");
  });

  it("should return success class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Success);
    sut.should.eq("nz-status-success");
  });

  it("should return error class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Error);
    sut.should.eq("nz-status-error");
  });

  it("should return warning class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Warning);
    sut.should.eq("nz-status-warning");
  });

  it("should return information status", () => {
    let res = StatusHelpers.severityToStatus(MessageSeverity.Information);
    res.should.eq(Status.Information);

    res = StatusHelpers.severityToStatus(MessageSeverity.Question);
    res.should.eq(Status.Information);
  });

  it("should return success status", () => {
    let res = StatusHelpers.severityToStatus(MessageSeverity.Success);
    res.should.eq(Status.Success);

    res = StatusHelpers.severityToStatus(MessageSeverity.None);
    res.should.eq(Status.Success);
  });

  it("should return error status", () => {
    let res = StatusHelpers.severityToStatus(MessageSeverity.Error);
    res.should.eq(Status.Error);

    res = StatusHelpers.severityToStatus(MessageSeverity.Fatal);
    res.should.eq(Status.Error);
  });

  it("should return warning status", () => {
    const res = StatusHelpers.severityToStatus(MessageSeverity.Warning);
    res.should.eq(Status.Warning);

  });
});
