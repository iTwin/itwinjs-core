/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  MessageButton,
  MessageHyperlink,
  MessageLayout,
  Message,
  MessageProgress,
  Status,
} from "@itwin/appui-layout-react";
import { cols2 } from "./Tools";

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
          <Message
            status={Status.Information}
            icon={
              <i className="icon icon-info-hollow" />
            }
          >
            <MessageLayout
              buttons={
                <>
                  <MessageHyperlink>Cancel</MessageHyperlink>
                  <MessageButton>
                    <i className="icon icon-close" />
                  </MessageButton>
                </>
              }
              progress={
                <MessageProgress
                  status={Status.Information}
                  progress={25}
                />
              }
            >
              Processing - 25% completed.
            </MessageLayout>
          </Message>
          <Message
            status={Status.Success}
            icon={
              <i className="icon icon-status-success-hollow" />
            }
          >
            <MessageLayout
              buttons={
                <>
                  <MessageHyperlink>View the report</MessageHyperlink>
                  <MessageButton>
                    <i className="icon icon-close" />
                  </MessageButton>
                </>
              }
            >
              Processing completed.
            </MessageLayout>
          </Message>
          <Message
            status={Status.Error}
            icon={
              <i className="icon icon-status-error-hollow" />
            }
          >
            <MessageLayout
              buttons={
                <>
                  <MessageHyperlink>View error log</MessageHyperlink>
                  <MessageButton>
                    <i className="icon icon-close" />
                  </MessageButton>
                </>
              }
            >
              Processing failed.
            </MessageLayout>
          </Message>
        </div>
      </div>
    );
  }
}
