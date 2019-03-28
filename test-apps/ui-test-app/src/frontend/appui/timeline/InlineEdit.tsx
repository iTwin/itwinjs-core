import * as React from "react";

interface InlineState {
  edit: boolean;
}

export class InlineEdit extends React.Component<any, InlineState> {
  private _input = React.createRef<HTMLInputElement>();

  constructor(props: any) {
    super(props);

    this.state = { edit: false };
  }

  private _handleBlur = (event: any) => {
    if (!event.target.contains(event.relatedTarget)) {
      this.setState({ edit: false });
    }
  }

  public render() {
    return (
      <div
        className={`inline ${this.state.edit ? "edit" : ""}`}
        onBlur={this._handleBlur}
      >
        <span className="value">{this.props.value}</span>
        <input type="text" value={this.props.value} ref={this._input} />
      </div>
    );
  }
}
