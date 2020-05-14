/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "highlight.js/styles/vs2015.css";
import * as React from "react";
import Markdown from "react-markdown";
import CodeBlock from "./CodeBlock";
import readmeFilePath from "@bentley/ui-ninezone/README.md";

const readmeResource = createResource((async function () {
  const response = await fetch(readmeFilePath);
  return response.text();
})());

export default function Readme() {
  const readme = readmeResource.read();
  return (
    <Markdown
      source={readme}
      renderers={{ code: CodeBlock }}
    />
  );
}

function createResource<T>(promise: Promise<T>) {
  let data: T;
  let error: any;
  (async function () {
    try {
      data = await promise;
    } catch (e) {
      error = e;
    }
  })();
  return {
    read() {
      if (error) throw error;
      if (!data) throw promise;
      return data;
    }
  };
}
