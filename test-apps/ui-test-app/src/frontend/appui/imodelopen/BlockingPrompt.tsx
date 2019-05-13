/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./BlockingPrompt.scss";
import "./Common.scss";
import { Spinner, SpinnerSize } from "@bentley/ui-core";

interface BlockingPromptProps {
  prompt: string;
}

/**
 * Display a message box centered in the view port with lightbox (ghosting background)
 */
export class BlockingPrompt extends React.Component<BlockingPromptProps> {

  constructor(props: BlockingPromptProps, context?: any) {
    super(props, context);
  }

  public render() {
    return (
      <div className="blocking-modal-background fade-in-fast">
        <div className="blocking-prompt fade-in">
          <Spinner size={SpinnerSize.Large} />
          <span>{this.props.prompt}</span>
        </div>
      </div>
    );
  }
}
