/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EditTxn, Element, IModelDb, IModelJsFs, OnElementPropsArg, StandaloneDb, Subject, withEditTxn } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

const relatedElementLabel = "Updated from element callback";

class ElementWithRelatedUpdate extends Element {
  public static override get className(): string { return "ElementWithRelatedUpdate"; }

  // __PUBLISH_EXTRACT_START__ EditTxn.ElementCallback
  protected static override onUpdate(arg: OnElementPropsArg): void {
    super.onUpdate(arg);
    if (undefined !== arg.props.parent)
      arg.iModel.getIndirectTxn().updateElement({ id: arg.props.parent.id, userLabel: "Updated from element callback" });
  }
  // __PUBLISH_EXTRACT_END__

  public static invokeOnUpdate(arg: OnElementPropsArg): void {
    this.onUpdate(arg);
  }
}

describe("EditTxn examples", () => {
  it("reuses the active transaction for writes from an element callback", () => {
    const fileName = IModelTestUtils.prepareOutputFile("EditTxnExamples", "EditTxnExamples.bim");
    const iModel = StandaloneDb.createEmpty(fileName, {
      rootSubject: { name: "EditTxn examples" },
      enableTransactions: true,
    });

    try {
      const childId = withEditTxn(iModel, (txn) => Subject.insert(txn, IModelDb.rootSubjectId, "Child subject"));
      const childProps = iModel.elements.getElementProps(childId);
      EditTxn.implicitWriteEnforcement = "throw";

      withEditTxn(iModel, (txn) => {
        ElementWithRelatedUpdate.invokeOnUpdate({ iModel, props: childProps });
        expect(iModel.getIndirectTxn()).to.equal(txn);
      });

      expect(iModel.elements.getElementProps(IModelDb.rootSubjectId).userLabel).to.equal(relatedElementLabel);
    } finally {
      EditTxn.implicitWriteEnforcement = "allow";
      iModel.close();
      IModelJsFs.removeSync(fileName);
    }
  });
});
