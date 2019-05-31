/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  ConfigurableUiManager, WidgetControl, ConfigurableCreateInfo, ValidationTextbox, InputStatus,
} from "@bentley/ui-framework";

/** Feedback Demo Widget */
export class FeedbackDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <FeedbackWidget />;
  }
}

/**
 * Sample widget component that contains feedback components
 * (ValidationTextbox, InputFieldMessage, PointerMessage)
 */
export class FeedbackWidget extends React.Component {
  /** hidden */

  public render() {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>No empty strings:</td>
              <td>
                {/* Defaults to check for empty value */}
                <ValidationTextbox
                  errorText="Cannot be blank"
                />
              </td>
            </tr>
            <tr>
              <td>No numbers:</td>
              <td>
                {/* Invalid if value provided is a number */}
                <ValidationTextbox
                  errorText="Cannot be blank or a number"
                  detailedErrorText="Please enter some value that is either a zero or non-numeric."
                  onValueChanged={(value: string) => {
                    if (!value || Number(value))
                      return InputStatus.Invalid;
                    return InputStatus.Valid;
                  }
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("FeedbackWidget", FeedbackDemoWidget);
