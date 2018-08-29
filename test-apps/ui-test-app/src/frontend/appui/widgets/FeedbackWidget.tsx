import * as React from "react";
import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ValidationTextbox } from "@bentley/ui-framework/lib/feedback/ValidationTextbox";
import { WidgetControl } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";

export class FeedbackDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <FeedbackWidget />;
  }
}

// Select categories in a viewport or all viewports of the current selected type (e.g. 3D/2D)
// Pass 'allViewports' property to ripple category changes to all viewports
export class FeedbackWidget extends React.Component<any, any> {
  public render() {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Type</th>
              <th>Sample</th>
            </tr>
            <tr>
              <td>ValidationTextbox</td>
              <ValidationTextbox />
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("FeedbackWidget", FeedbackDemoWidget);
