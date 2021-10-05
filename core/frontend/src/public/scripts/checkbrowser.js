/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// refuse to continue if using Internet Explorer or old Microsoft Edge.
if (!!document.documentMode || !!window.StyleMedia) {
  const body = document.createElement("body");
  const newDiv = document.createElement("div");
  newDiv.style.font = "normal bold 16px sans-serif";
  newDiv.style.display = "flex";
  newDiv.style.justifyContent = "center";
  newDiv.style.position = "relative";
  newDiv.style.top = "25%";
  newDiv.innerHTML = "Sorry, the browser you are using is not supported. Please use Firefox, Chrome, or Safari.";
  body.appendChild(newDiv);
  document.body = body;

  // remove all the other script tags from the head.
  var scripts = document.head.getElementsByTagName("script");
  for (var i = 0; i < scripts.length; i++) {
    document.head.removeChild(scripts[i]);
  }
}
