/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

// cSpell:ignore linkify

import LinkifyIt = require("linkify-it");

const linkify = new LinkifyIt({ fuzzyLink: false });

linkify
  .add("pw:", {
    validate: (text: string, pos: number, self: LinkifyIt.LinkifyIt): number => {
      const tail = text.slice(pos);

      // istanbul ignore else
      if (!self.re.pw) {
        self.re.pw = new RegExp(
          `(//|\\\\\\\\)${self.re.src_host}:` +
          // Regex for path according to RFC 3986 standards plus the possibility to write '{}' brackets for ProjectWise monikers
          `([a-zA-Z0-9-._~!$&'()*+,;=@%{}]+/)+[a-zA-Z0-9-._~!$&'()*+,;=@%{}]*`,
          "i");
      }
      // istanbul ignore else
      if (self.re.pw.test(tail)) {
        const matches = tail.match(self.re.pw);
        // istanbul ignore else
        if (matches !== null)
          return matches[0].length;
      }
      // istanbul ignore next
      return 0;
    },
  })
  /* Adding a custom schema for links that start with `www.`.
     With fuzzyLink option set to true it matches text without `www.` as a prefix, which is not wanted in our case. */
  .add("www.", {
    validate: (text: string, pos: number, self: LinkifyIt.LinkifyIt): number => {
      const tail = text.slice(pos);

      if (!self.re.www) {
        self.re.www = new RegExp(
          `^${self.re.src_auth}${self.re.src_host_port_strict}${self.re.src_path}`,
          "i");
      }
      // istanbul ignore else
      if (self.re.www.test(tail)) {
        const matches = tail.match(self.re.www);
        // istanbul ignore else
        if (matches !== null)
          return matches[0].length;
      }
      // istanbul ignore next
      return 0;
    },
    normalize: (match: LinkifyIt.Match) => {
      match.schema = "http:";
      match.url = `http://${match.url}`;
    },
  });

/** Returns a list of links from a text
 * @public
 */
export const matchLinks = (text: string): Array<{ index: number, lastIndex: number, schema: string, url: string }> => {
  const head = text.slice(0, 5);
  if (head === "pw://" || head === "pw:\\\\")
    return Array({ index: 0, lastIndex: text.length, schema: "pw:", url: text});

  const matches = linkify.match(text);
  return matches ? matches as Array<{ index: number, lastIndex: number, schema: string, url: string }> : [];
};
