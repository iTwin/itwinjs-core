/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { ShowHideDialog } from "../../../components-react";
import TestUtils from "../../TestUtils";

describe("ShowHideDialog", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("<ShowHideDialog />", () => {
    const items = [{ id: "0", label: "" }, { id: "1", label: "Item 1" }, { id: "2", label: "Item 2" }, { id: "3", label: "Item 3" }];
    it("should render", () => {
      render(<ShowHideDialog
        items={items}
        opened={true} />);
    });
    it("should close", () => {
      const { rerender, getByTestId, queryByTestId } = render(<ShowHideDialog
        items={items}
        opened={true} />);
      expect(getByTestId("core-dialog-container")).to.exist;
      rerender(<ShowHideDialog
        items={items}
        opened={false} />);
      expect(queryByTestId("core-dialog-container" as any)).to.not.exist;
    });
    it("should render with initialHidden", () => {
      const { getByLabelText } = render(<ShowHideDialog
        items={items}
        opened={true} initialHidden={["1"]} />);
      expect((getByLabelText("Item 1") as HTMLInputElement).checked).to.be.false;
    });
    it("should update initialHidden", async () => {
      const { rerender, getByLabelText } = render(<ShowHideDialog
        items={items}
        opened={true} initialHidden={["1"]} />);
      const item1 = getByLabelText("Item 1") as HTMLInputElement;
      const item2 = getByLabelText("Item 2") as HTMLInputElement;
      expect(item1.checked).to.be.false;
      expect(item2.checked).to.be.true;
      rerender(<ShowHideDialog
        items={items}
        opened={true} initialHidden={["2"]} />);
      expect(item1.checked).to.be.true;
      expect(item2.checked).to.be.false;
    });
    it("should toggle checked", async () => {
      const { getByLabelText } = render(<ShowHideDialog
        items={items} opened={true} />);
      const item1 = getByLabelText("Item 1") as HTMLInputElement;
      fireEvent.click(item1);
      expect(item1.checked).to.be.false;
      fireEvent.click(item1);
      expect(item1.checked).to.be.true;
    });
    it("should trigger onShowHideChange", async () => {
      const showHideChange = sinon.spy();
      const { getByLabelText } = render(<ShowHideDialog
        items={items} opened={true} onShowHideChange={showHideChange} />);
      const item1 = getByLabelText("Item 1") as HTMLInputElement;
      fireEvent.click(item1);
      expect(showHideChange).to.have.been.calledWithMatch(["1"]);
      fireEvent.click(item1);
      expect(showHideChange).to.have.been.calledWithMatch([]);
    });
  });
});
