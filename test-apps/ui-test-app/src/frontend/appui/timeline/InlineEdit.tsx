import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "@bentley/ui-ninezone";
import "./InlineEdit.scss";

interface InlineEditProps extends CommonProps {
  defaultValue: string;
  onChange?: (value: string) => void;
}

interface InlineEditState {
  value: string;
}

export class InlineEdit extends React.Component<InlineEditProps, InlineEditState> {

  constructor(props: InlineEditProps) {
    super(props);

    this.state = { value: this.props.defaultValue };
  }

  public componentWillReceiveProps(newProps: InlineEditProps) {
    if (newProps.defaultValue !== this.props.defaultValue) {
      this.setState({ value: newProps.defaultValue });
    }
  }

  private _onBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (this.props.onChange)
      this.props.onChange(value);
  }

  private _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  }

  public render() {
    return (
      <input
        className={classnames("inline-edit-input", this.props.className)}
        type="text"
        value={this.state.value}
        onBlur={this._onBlur}
        onChange={this._onChange} />
    );
  }
}
