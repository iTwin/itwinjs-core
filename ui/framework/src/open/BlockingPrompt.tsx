import * as React from "react";
import "./BlockingPrompt.scss";
// import "../components.scss";
import "./Common.scss";

interface IBlockingPromptProps {
  prompt: string;
}

export class BlockingPrompt extends React.Component<IBlockingPromptProps> {

  constructor(props: IBlockingPromptProps, context?: any) {
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
