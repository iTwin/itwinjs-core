/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { cols2 } from "./Tools";

import ActivityMessage from "@src/footer/message/Activity";
import StatusMessage from "@src/footer/message/content/status/Message";
import StatusLayout from "@src/footer/message/content/status/Layout";
import Label from "@src/footer/message/content/Label";
import Hyperlink from "@src/footer/message/content/Hyperlink";
import Progress from "@src/footer/message/content/Progress";
import Button from "@src/footer/message/content/Button";
import Status from "@src/footer/message/content/status/Status";

export const cols3: React.CSSProperties = {
  ...cols2,
  gridTemplateColumns: "1fr 1fr 1fr",
};

export default class Footer extends React.Component {
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
          <ActivityMessage>
            <StatusMessage
              status={Status.Information}
              icon={
                <i className="icon icon-info-hollow" />
              }
            >
              <StatusLayout
                label={
                  <Label text="Processing - 25% completed." />
                }
                buttons={
                  <>
                    <Hyperlink text="Cancel" />
                    <Button>
                      <i className="icon icon-close" />
                    </Button>
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
          </ActivityMessage>
          <ActivityMessage>
            <StatusMessage
              status={Status.Success}
              icon={
                <i className="icon icon-status-success-hollow" />
              }
            >
              <StatusLayout
                label={
                  <Label text="Processing completed." />
                }
                buttons={
                  <>
                    <Hyperlink text="View the report" />
                    <Button>
                      <i className="icon icon-close" />
                    </Button>
                  </>
                }
              />
            </StatusMessage>
          </ActivityMessage>
          <ActivityMessage>
            <StatusMessage
              status={Status.Error}
              icon={
                <i className="icon icon-status-error-hollow" />
              }
            >
              <StatusLayout
                label={
                  <Label text="Processing failed." />
                }
                buttons={
                  <>
                    <Hyperlink text="View error log" />
                    <Button>
                      <i className="icon icon-close" />
                    </Button>
                  </>
                }
              />
            </StatusMessage>
          </ActivityMessage>
        </div>
      </div>
    );
  }
}
