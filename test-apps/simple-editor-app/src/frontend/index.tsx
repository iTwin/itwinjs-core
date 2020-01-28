/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import { SimpleEditorApp } from "./api/SimpleEditorApp";
import App from "./components/App";
import "./index.css";
import { ErrorHandling } from "./api/ErrorHandling";

// initialize the application
SimpleEditorApp.startup();

SimpleEditorApp.ready
  .then(() => {
    // when initialization is complete, render
    ReactDOM.render(
      <App />,
      document.getElementById("root") as HTMLElement,
    );
  })
  .catch((err) => ErrorHandling.onUnexpectedError(err));
