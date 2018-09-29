/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as HighlightJs from "highlight.js";
import * as React from "react";

export interface Props {
  language: string;
  value: string;
}

export default class CodeBlock extends React.Component<Props> {
  private _code: HTMLElement | undefined = undefined;

  public componentDidMount() {
    this.highlightCode();
  }

  public componentDidUpdate() {
    this.highlightCode();
  }

  public render() {
    return (
      <pre>
        <code ref={(ref) => ref && (this._code = ref)} className={this.props.language}>
          {this.props.value}
        </code>
      </pre>
    );
  }

  private highlightCode() {
    if (!this._code)
      return;

    HighlightJs.highlightBlock(this._code);
  }
}
