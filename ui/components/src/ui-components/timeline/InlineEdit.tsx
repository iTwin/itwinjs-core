/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import "./InlineEdit.scss";

interface InlineEditProps extends CommonProps {
  defaultValue: string;
  onChange?: (value: string) => void;
}

interface InlineEditState {
  value: string;
  originalValue: string;
}

/** Duration Inline Editor
 * @internal
 */
export class InlineEdit extends React.Component<InlineEditProps, InlineEditState> {
  private _inputRef = React.createRef<HTMLInputElement>();

  constructor(props: InlineEditProps) {
    super(props);

    this.state = { value: this.props.defaultValue, originalValue: this.props.defaultValue };
  }

  // TODO - Fix this so the unit test still runs successfully - must use getDerivedStateFromProps or componentDidUpdate
  /** @internal */
  public UNSAFE_componentWillReceiveProps(newProps: InlineEditProps) {    // tslint:disable-line: naming-convention
    if (newProps.defaultValue !== this.state.value) {
      this.setState({ value: newProps.defaultValue, originalValue: newProps.defaultValue });
    }
  }

  // istanbul ignore next
  private _onBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
    this._sendChange(event.target.value);
  }

  private _onFocus = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.target.select();
  }

  private _onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      this.setState(
        (prevState) => ({ value: prevState.originalValue }),
        () => this._inputRef.current!.select());
    } else if (event.key === "Enter") {
      this._sendChange(this.state.value);
    }
  }

  private _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  }

  private _sendChange(value: string) {
    // istanbul ignore else
    if (this.props.onChange)
      this.props.onChange(value);
  }

  public render() {
    return (
      <input
        data-testid="timeline-duration-edit-input"
        className={classnames("inline-edit-input", this.props.className)}
        ref={this._inputRef}
        type="text"
        value={this.state.value}
        onFocus={this._onFocus}
        onBlur={this._onBlur}
        onKeyDown={this._onKeyDown}
        onChange={this._onChange} />
    );
  }
}
