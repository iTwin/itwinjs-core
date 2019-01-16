/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { cols2 } from "./Tools";

import { Activity } from "@src/footer/message/Activity";
import { StatusMessage } from "@src/footer/message/content/status/Message";
import { MessageLayout } from "@src/footer/message/content/status/Layout";
import { Label } from "@src/footer/message/content/Label";
import { Hyperlink } from "@src/footer/message/content/Hyperlink";
import { Progress } from "@src/footer/message/content/Progress";
import { MessageButton } from "@src/footer/message/content/Button";
import { Status } from "@src/footer/message/content/status/Status";

export const cols3: React.CSSProperties = {
  ...cols2,
  gridTemplateColumns: "1fr 1fr 1fr",
};

export default class Footer extends React.PureComponent {
  public render() {
    return (
      <div
        style={{
          padding: "10px",
          backgroundColor: "gray",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <h1>Messages</h1>
        <div style={cols3}>
          <Activity>
            <StatusMessage
              status={Status.Information}
              icon={
                <i className="icon icon-info-hollow" />
              }
            >
              <MessageLayout
                label={
                  <Label text="Processing - 25% completed." />
                }
                buttons={
                  <>
                    <Hyperlink text="Cancel" />
                    <MessageButton>
                      <i className="icon icon-close" />
                    </MessageButton>
                  </>
                }
                progress={
                  <Progress
                    status={Status.Information}
                    progress={25}
                  />
                }
              />
            </StatusMessage>
          </Activity>
          <Activity>
            <StatusMessage
              status={Status.Success}
              icon={
                <i className="icon icon-status-success-hollow" />
              }
            >
              <MessageLayout
                label={
                  <Label text="Processing completed." />
                }
                buttons={
                  <>
                    <Hyperlink text="View the report" />
                    <MessageButton>
                      <i className="icon icon-close" />
                    </MessageButton>
                  </>
                }
              />
            </StatusMessage>
          </Activity>
          <Activity>
            <StatusMessage
              status={Status.Error}
              icon={
                <i className="icon icon-status-error-hollow" />
              }
            >
              <MessageLayout
                label={
                  <Label text="Processing failed." />
                }
                buttons={
                  <>
                    <Hyperlink text="View error log" />
                    <MessageButton>
                      <i className="icon icon-close" />
                    </MessageButton>
                  </>
                }
              />
            </StatusMessage>
          </Activity>
        </div>
      </div>
    );
  }
}
