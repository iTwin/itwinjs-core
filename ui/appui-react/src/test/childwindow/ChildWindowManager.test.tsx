/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { ChildWindowManager } from "../../appui-react";
import { copyStyles } from "../../appui-react/childwindow/CopyStyles";

describe("ChildWindowManager", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("will construct", () => {
    const manager = new ChildWindowManager();

    expect(manager.findChildWindowId(undefined)).to.undefined;
    expect(manager.findChildWindow(undefined)).to.undefined;
  });

  it("will find id", () => {
    const manager = new ChildWindowManager();
    const childWindowInfo = {
      childWindowId: "child",
      window,
      parentWindow: {} as Window,
    };

    sinon.stub(manager, "openChildWindows").get(() => [childWindowInfo]);
    expect(manager.closeChildWindow("bogus", false)).to.eql(false);

    expect(manager.findChildWindowId(window)).to.be.eql("child");
    expect(manager.findChildWindow("child")).to.not.be.undefined;
    expect(manager.closeChildWindow("child", false)).to.eql(true);
  });

  it("will find id and close", () => {
    const manager = new ChildWindowManager();
    const childWindowInfo = {
      childWindowId: "child",
      window,
      parentWindow: {} as Window,
    };

    sinon.stub(manager, "openChildWindows").get(() => [childWindowInfo]);
    expect(manager.findChildWindowId(window)).to.be.eql("child");
    expect(manager.findChildWindow("child")).to.not.be.undefined;
    const closeStub = sinon.stub();
    sinon.stub(window, "close").callsFake(closeStub);
    expect(manager.closeChildWindow("child")).to.eql(true);
    expect(closeStub).to.be.called;
  });

});

describe("ChildWindowManager", () => {
  const mainHtml = `
    <head>
      <title>iModel.js Presentation Test App</title>
      <style>
        h1 {color:red;}
        p {color:blue;}
      </style>
    </head>
    <body>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
        style="position: absolute; width: 0; height: 0" id="__SVG_SPRITE_NODE__">
        <symbol xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" id="window-settings--sprite">
          <path
            d="m7 12h-6v-8h11v3h1v-7h-13v13h7zm4-11h1v1h-1zm-2 0h1v1h-1zm6 10.01-.2-.36v-.05c.45-1 .4-1.07.35-1.17l-.6-.56a.16992.16992 0 0 0 -.1-.05c-.05 0-.15 0-1 .41h-.05l-.4-.16v-.06c-.45-1-.5-1-.6-1h-.85c-.1 0-.15 0-.55 1.07v.05l-.35.1a6.45032 6.45032 0 0 0 -1-.41s-.1 0-.1.05l-.6.61c0 .1-.1.1.35 1.12v.05l-.2.36c-1 .41-1 .46-1 .56v.87c0 .1 0 .15 1 .56l.15.36v.05c-.45 1-.4 1.07-.35 1.17l.6.56a.17.17 0 0 0 .1.05 3.94523 3.94523 0 0 0 1-.41l.35.1v.05c.4 1.07.45 1.07.55 1.07h.85c.1 0 .15 0 .55-1.07v-.05l.35-.15h.05a6.45982 6.45982 0 0 0 1 .41c.05 0 .1 0 .1-.05l.6-.61c.1-.1.1-.1-.35-1.12v-.05l.15-.36h.2c1-.41 1-.46 1-.56v-.82c0-.1 0-.15-1-.56zm-3 2.51a1.5 1.5 0 1 1 .02007 0q-.01007.00006-.02007 0z">
          </path>
        </symbol>
        <symbol xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" id="distance--sprite">
          <title>distance</title>
          <rect y="11" width="16" height="1"></rect>
          <polygon
            points="15 4 15 5.875 12 4 12 6 4 6 4 4 1 5.875 1 4 0 4 0 9 1 9 1 7.125 4 9 4 7 12 7 12 9 15 7.125 15 9 16 9 16 4 15 4">
          </polygon>
        </symbol>
      </svg>
      <noscript>
        You need to enable JavaScript to run this app.
      </noscript>
      <div id="root"></div>
    </body>
  `;

  const childHtml = `
    <head>
      <title>iTwinPopup</title>
    </head>
    <body>
      <noscript>
        You need to enable JavaScript to run this app.
      </noscript>
      <div id="root"></div>
    </body>
  `;

  afterEach(() => {
    sinon.restore();
  });

  it("no styles to styles", () => {
    const childDoc = new DOMParser().parseFromString(childHtml, "text/html");
    copyStyles(childDoc);
    const childStyleSheetCount = childDoc.head.querySelectorAll("style").length;
    const documentStyleSheetCount = document.head.querySelectorAll("style").length;
    expect(documentStyleSheetCount).to.eql(childStyleSheetCount);
  });

  it("will copy styles", () => {
    const mainDoc = new DOMParser().parseFromString(mainHtml, "text/html");
    const childDoc = new DOMParser().parseFromString(childHtml, "text/html");
    copyStyles(childDoc, mainDoc);
    expect(childDoc.getElementById("__SVG_SPRITE_NODE__")).to.not.be.null;
    expect(mainDoc.styleSheets.length).to.eql(childDoc.styleSheets.length);
  });

});
