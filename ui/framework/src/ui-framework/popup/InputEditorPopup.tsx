/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { OnCancelFunc, OnNumberCommitFunc } from "@bentley/ui-abstract";
import { DivWithOutsideClick, SizeProps, Size } from "@bentley/ui-core";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";

import { PositionPopup, PositionPopupContent } from "./PositionPopup";
import { PopupManager, PopupPropsBase } from "./PopupManager";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";

/** @alpha */
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

/** @internal */
interface InputEditorPopupState {
  size: Size;
}

/** Popup component for Input Editor
 * @alpha
 */
export class InputEditorPopup extends React.PureComponent<InputEditorPopupProps, InputEditorPopupState> {
  /** @internal */
  public readonly state = {
    size: new Size(-1, -1),
  };

  private _onSizeKnown = (newSize: SizeProps) => {
    // istanbul ignore else
    if (!this.state.size.equals(newSize))
      this.setState({ size: Size.create(newSize) });
  }

  /** @internal */
  public render() {
    const point = PopupManager.getPopupPosition(this.props.el, this.props.pt, this.props.offset, this.state.size);

    return (
      <PositionPopup key={this.props.id}
        point={point}
        onSizeKnown={this._onSizeKnown}
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
