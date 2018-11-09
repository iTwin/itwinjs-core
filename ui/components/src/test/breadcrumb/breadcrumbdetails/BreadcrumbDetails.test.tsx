/*---------------------------------------------------------------------------------------------
 | $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { waitForUpdate } from "../../test-helpers/misc";
import { render, cleanup, RenderResult, waitForElement } from "react-testing-library";
import { BreadcrumbDetails, BreadcrumbPath } from "../../../index";
import { mockRawTreeDataProvider, mockInterfaceTreeDataProvider } from "../mockTreeDataProvider";

afterEach(cleanup);

describe("BreadcrumbDetails", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;
  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
  });

  describe("<BreadcrumbDetails />", () => {
    it("should render", () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
    });
    it("should render with interface dataProvider", () => {
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
    });

    it("should update path to child", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(undefined);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 11);
      const node = mockRawTreeDataProvider[1];
      expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
    });
  });
});
