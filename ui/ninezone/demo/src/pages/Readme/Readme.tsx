/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as Markdown from "react-markdown";

import CodeBlock from "./CodeBlock";

import * as readmeFile from "@src/../README.md";

import "highlight.js/styles/vs2015.css";

export default class Readme extends React.Component {
  public render() {
    return (
      <Markdown
        source={readmeFile}
        renderers={{ code: CodeBlock }}
      />
    );
  }
}
