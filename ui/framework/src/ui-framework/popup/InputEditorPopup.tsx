/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { OnCancelFunc, OnNumberCommitFunc } from "@bentley/ui-abstract";
import { DivWithOutsideClick } from "@bentley/ui-core";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";

import { PositionPopup, PositionPopupContent } from "./PositionPopup";
import { PopupManager, PopupPropsBase } from "./PopupManager";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";

/** @internal */
export class InputEditorCommitHandler {
  constructor(
    public readonly onCommit: OnNumberCommitFunc,
  ) { }

  public handleCommit = (args: PropertyUpdatedArgs) => {
    let newValue = 0;
    // istanbul ignore else
    if (args.newValue.valueFormat === PropertyValueFormat.Primitive) {
      newValue = args.newValue.value as number;
    }
    this.onCommit(newValue);
  }
}

/** @alpha */
export interface InputEditorPopupProps extends PopupPropsBase {
  record: PropertyRecord;
  onCancel: OnCancelFunc;
  commitHandler: InputEditorCommitHandler;
}

/** Popup component for Input Editor
 * @alpha
 */
export class InputEditorPopup extends React.PureComponent<InputEditorPopupProps> {

  public render() {
    const point = PopupManager.getPopupPosition(this.props.el, this.props.pt, this.props.offset, this.props.size);

    return (
      <PositionPopup key={this.props.id}
        point={point}
        onSizeKnown={this.props.onSizeKnown}
      >
        <DivWithOutsideClick onOutsideClick={this.props.onCancel}>
          <PositionPopupContent>
            <EditorContainer
              propertyRecord={this.props.record}
              onCommit={this.props.commitHandler.handleCommit}
              onCancel={this.props.onCancel}
              setFocus={true} />
          </PositionPopupContent>
        </DivWithOutsideClick>
      </PositionPopup>
    );
  }
}
