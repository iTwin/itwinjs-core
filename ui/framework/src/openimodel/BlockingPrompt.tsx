/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./BlockingPrompt.scss";
import "./Common.scss";

interface BlockingPromptProps {
  prompt: string;
}

export class BlockingPrompt extends React.Component<BlockingPromptProps> {

  constructor(props: BlockingPromptProps, context?: any) {
    super(props, context);
  }

  public render() {
    return (
      <div className="blocking-modal-background fade-in-fast">
         <div className="blocking-prompt fade-in">
          <div className="loader-large"><i /><i /><i /><i /><i /><i /></div>
          <span>{this.props.prompt}</span>
        </div>
      </div>
    );
  }
}
