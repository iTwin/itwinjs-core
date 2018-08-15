/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CSSProperties } from "react";

import { ViewportComponent } from "@bentley/ui-components";
import { ConfigurableCreateInfo, ConfigurableUiManager } from "@bentley/ui-framework";
import { ContentControl } from "@bentley/ui-framework";
import { ContentViewManager } from "@bentley/ui-framework";

/** iModel Viewport Control
 */
export class IModelViewportControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options.viewId) {
      this.reactElement = <ViewportComponent viewDefinitionId={options.viewId} imodel={options.iModelConnection} />;
    } else {
      this.reactElement = <MockIModelViewport bgColor={options.bgColor} />;
    }
  }
}

// This is used for fake viewports (those with no ViewId)
interface MockIModelViewportProps {
  bgColor: string;
}

/** iModel Viewport React component */
class MockIModelViewport extends React.Component<MockIModelViewportProps> {
  // private _containerDiv: HTMLDivElement|null;
  private _htmlCanvas!: HTMLCanvasElement;

  constructor(props: MockIModelViewportProps) {
    super(props);
  }

  public render(): React.ReactNode {
    const divStyle: CSSProperties = {
      backgroundColor: this.props.bgColor,
    };
    const canvasStyle: CSSProperties = {
      width: "100%",
      height: "100%",
    };

    return (
      <div className="ContentViewPane" style={divStyle}>
        <canvas className="unselectable" style={canvasStyle} ref={(element: any) => { this._htmlCanvas = element; }}
          onMouseMove={this._onMouseMove}
          onMouseLeave={this._onMouseLeave}
          onMouseDown={this._onMouseDown}
          onMouseUp={this._onMouseUp}
        />
      </div>
    );
  }

  private drawCanvas(event: React.MouseEvent<HTMLCanvasElement>, isMouseDown: boolean) {
    const canvas = this._htmlCanvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const boundingRect: DOMRect = (event.nativeEvent.target as any).getBoundingClientRect();
      const canvasX = (event.clientX - boundingRect.left);
      const canvasY = (event.clientY - boundingRect.top);

      // clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw the text
      ctx.font = "10px Arial";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      const text = "Mouse Info:  X: " + canvasX + " Y: " + canvasY + " Down: " + isMouseDown;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }

  private _onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, ContentViewManager.isMouseDown);
  }

  private _onMouseLeave = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = this._htmlCanvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const boundingRect: DOMRect = (event.nativeEvent.target as any).getBoundingClientRect();
      ctx.clearRect(0, 0, boundingRect.width, boundingRect.height);
    }
  }

  private _onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, true);
    event.preventDefault();
  }

  private _onMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, false);
  }
}

export default IModelViewportControl;

ConfigurableUiManager.registerControl("IModelViewport", IModelViewportControl);
