/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

// cSpell:ignore segoe

let iModelJsCss: string | undefined = `
:root {
  --background-1:#ffffff;
  --background-2:#f8f9fb;
  --background-3:#eef0f3;
  --background-4:#dce0e3;
  --background-5:#c7ccd1;
  --foreground-body:#000000;
  --foreground-primary:#008be1;
  --foreground-success:#56a91c;
  --foreground-alert:#d30a0a;
  --foreground-warning:#f18b12;
  --safe-area-top: constant(safe-area-inset-top);
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-left: constant(safe-area-inset-left);
  --safe-area-left: env(safe-area-inset-left);
  --safe-area-bottom: constant(safe-area-inset-bottom);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-right: constant(safe-area-inset-right);
  --safe-area-right: env(safe-area-inset-right);
}

.logo-card-logo {
  width:124px;
  overflow:hidden;
  vertical-align:text-top;
  text-align:center
}

.logo-card-logo img {
  margin-top:4px;
  border: solid 3px var(--background-1)
}

.logo-card-message p {
  font-size:13px;
  line-height:1.25;
  margin-block-start:.5em;
  margin-block-end:3em;
  width:90%;
  opacity:.7
}

.logo-cards h2 {
  margin:auto;
  font-size:18px;
  font-weight:bold;
  opacity:.85
}

.logo-cards {
  position:relative;
  width:100%
}

.imodeljs-modal-overlay {
  top:0;
  left:0;
  width:100%;
  height:100%;
  position:absolute;
  display:flex;
  justify-content:center;
  align-items:center;
  background-color:rgba(0,0,0,.5);
  z-index:10000;
}

.imodeljs-modal {
  border-radius:3px;
  box-shadow: 0px 1px 3px 0 rgba(0,0,0,0.1);
  color:var(--foreground-body);
  background-color:var(--background-1);
  font-family:"Segoe UI","Open Sans",sans-serif;
  font-weight:normal;
  font-stretch:normal;
  font-style:normal;
  letter-spacing:normal;
  text-align:left;
  --width-border: max(var(--safe-area-left), var(--safe-area-right), 16px);
  --height-border: max(var(--safe-area-top), var(--safe-area-bottom), 16px);
  max-height: calc(100% - (2 * var(--height-border)));
  overflow: auto;
}

@media (max-width:450px) {
  .imodeljs-about .logo-card-logo {
    width: 90px;
  }
}

@media (max-height:450px) {
  .imodeljs-about {
    max-width: calc(100% - (2 * var(--width-border))) !important;
    width: unset !important;
  }
  .imodeljs-about .logo-card-message p {
    margin-block-end: 1em;
  }
  .imodeljs-about .logo-cards {
    margin-bottom: 2em;
  }
}

.imodeljs-modal-close {
  font-size:32px;
  text-align:right;
  position:relative;
  cursor:pointer;
  right:10px;
  top:-4px;
  margin:0;
  margin-bottom:-10px
}

.imodeljs-icon {
  z-index:11;
  left:8px;
  bottom:8px;
  position:absolute;
  width:32px;
  cursor:pointer;
  opacity:.4;
  filter:drop-shadow(1px 1px 1px black)
}

@media (hover: hover) {
  .imodeljs-icon:hover {
    opacity:1.0;
  }
}
`;

// add the iModel.js frontend .css styles into DOM head when we load
(() => {
  // Skip adding the css to document if document does not exist.
  if ("undefined" === typeof document)
    return;
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(iModelJsCss.replace(/\s+/gm, " "))); // strips multiple spaces and space+\r
  const openSans = document.createElement("link");
  openSans.rel = "stylesheet";
  openSans.href = "https://fonts.googleapis.com/css?family=Open+Sans&display=swap";
  document.head.prepend(style); // put our styles at the beginning so any application-supplied styles will override them
  document.head.prepend(openSans);
  iModelJsCss = undefined; // can only be called once
})();
