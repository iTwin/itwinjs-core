/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DialogButtonStyle, DialogButtonType, MessageSeverity } from "@itwin/appui-abstract";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { MessageBox } from "../../core-react";
import { MessageContainer } from "../../core-react/messagebox/MessageBox";
import TestUtils, { classesFromElement } from "../TestUtils";

describe("MessageBox", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  const buttonCluster = [
    { type: DialogButtonType.Close, buttonStyle: DialogButtonStyle.Primary, onClick: () => { } },
  ];

  describe("renders", () => {
    it("should render content in an open dialog", () => {
      render(<MessageBox opened={true} severity={MessageSeverity.Information} buttonCluster={buttonCluster}><div>Content</div></MessageBox>);

      expect(screen.getByText("Content", {selector: ".core-dialog.core-dialog-opened .core-message-box-container .core-message-box-content > div"})).to.exist;
    });
  });

  describe("renders different severities", () => {
    it("MessageSeverity.Question", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.Question} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.include("core-message-box-question");
    });
    it("MessageSeverity.Warning", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.Warning} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.include("core-message-box-warning");
    });
    it("MessageSeverity.Error", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.Error} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.include("core-message-box-error");
    });
    it("MessageSeverity.Fatal", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.Fatal} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.include("core-message-box-fatal");
    });
    it("MessageSeverity.None", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.None} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.not.include.members(
        ["icon-status-success-hollow" , "icon-status-success" , "core-message-box-success",
          "icon-info-hollow" , "icon-info" , "core-message-box-information",
          "icon-help-hollow" , "icon-help" , "core-message-box-question",
          "icon-status-warning" , "core-message-box-warning",
          "icon-status-error-hollow" , "icon-status-error" , "core-message-box-error",
          "icon-status-rejected" , "icon-status-rejected" , "core-message-box-fatal",
        ]
      );
    });
    it("MessageSeverity.Success", () => {
      const {container} = render(<MessageBox opened={true} severity={MessageSeverity.Success} buttonCluster={buttonCluster} />);
      expect(classesFromElement(container.querySelector(".core-message-box-container")?.firstElementChild)).to.include("core-message-box-success");
    });

  });

  describe("MessageContainer.getIconClassName with hollow param", () => {
    ([["None",MessageSeverity.None, " "],
      ["Information",MessageSeverity.Information, "icon-info-hollow"],
      ["Question",MessageSeverity.Question, "icon-help-hollow"],
      ["Warning",MessageSeverity.Warning, "icon-status-warning"],
      ["Error",MessageSeverity.Error, "icon-status-error-hollow"],
      ["Fatal",MessageSeverity.Fatal, "icon-status-rejected"],
      ["Success",MessageSeverity.Success, "icon-status-success-hollow"],
    ] as [string, MessageSeverity, string][]).map(([name, severity, className]) => {
      it(`hollow icon for ${name}`, () => {
        expect(MessageContainer.getIconClassName(severity, true)).to.include(className);
      });
    });
  });

});
