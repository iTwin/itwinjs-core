/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler } from "webpack";
import { getSourcePosition } from "../utils/paths";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const CommonJsRequireDependency = require("webpack/lib/dependencies/CommonJsRequireDependency");
const RequireHeaderDependency = require("webpack/lib/dependencies/RequireHeaderDependency");
const RequireResolveDependency = require("webpack/lib/dependencies/RequireResolveDependency");
const RequireResolveHeaderDependency = require("webpack/lib/dependencies/RequireResolveHeaderDependency");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

interface MagicCommentHandlerConfig {
  test: string | RegExp;
  handler: (request: string, comment: string) => string;
}

/**
 * General purpose webpack plugin for using "magic comments" to change the argument ("request" in webpack terminology) of a `require` or `require.resolve` statement.
 *
 * For example, using:
 * ```
 * new RequireMagicCommentsPlugin([
 *   { test: /foo/, handler: (request) => request + "?foo" },
 * ]),
 * ```
 *
 * Will result in webpack treating `require(/* foo *﻿/"bar")` as if it had been `require("bar?foo")`.
 */
export class RequireMagicCommentsPlugin {
  constructor(private _configs: MagicCommentHandlerConfig[]) { }

  public apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap("RequireMagicCommentsPlugin", (nmf) => {
      nmf.hooks.parser.for("javascript/auto").tap("RequireMagicCommentsPlugin", (parser: any) => {
        parser.hooks.call.for("require").tap("RequireMagicCommentsPlugin", this.handleCommonJs(parser, CommonJsRequireDependency, RequireHeaderDependency));
        parser.hooks.call.for("require.resolve").tap("RequireMagicCommentsPlugin", this.handleCommonJs(parser, RequireResolveDependency, RequireResolveHeaderDependency));
      });
    });
  }

  private testComment(comment: string, strOrRegex: string | RegExp) {
    if (typeof strOrRegex === "string")
      return comment.trim() === strOrRegex;

    return strOrRegex.test(comment);
  }

  private handleCommonJs(parser: any, depType: any, headerType: any) {
    return (expr: any): true | void => {
      if (expr.arguments.length !== 1 || !parser.state.compilation)
        return;

      const logger = parser.state.compilation.getLogger("RequireMagicCommentsPlugin");
      let param: any;
      let request: any;
      for (const comment of parser.getComments(expr.range)) {
        for (const { test, handler } of this._configs) {
          if (!this.testComment(comment.value, test))
            continue;

          if (!request) {
            // We can only handle string expressions, but don't even bother evaluating until we're sure there's a matching comment.
            param = parser.evaluateExpression(expr.arguments[0]);
            if (!param.isString())
              return;

            request = param.string;
          }

          request = handler(request, comment.value);
          logger.log(`Handler for /*${comment.value}*/ - transformed "${param.string}" => "${request}" at ${getSourcePosition(parser.state.current, expr.loc)}`);
        }
      }

      if (request) {
        const requireDependency = new depType(request, param.range);
        requireDependency.loc = expr.loc;
        requireDependency.optional = false;
        requireDependency.weak = false;
        parser.state.current.addDependency(requireDependency);

        const headerDependency = new headerType(expr.callee.range);
        headerDependency.loc = expr.loc;
        parser.state.current.addDependency(headerDependency);
        return true;
      }
    };
  }
}

const externalPrefix = "BeWebpack-EXTERNAL:";
export const addExternalPrefix = (req: string) => externalPrefix + req;
export const handlePrefixedExternals = (_ctx: any, request: string, cb: any) => {
  if (request.startsWith(externalPrefix)) {
    cb(null, request.replace(externalPrefix, ""), "commonjs");
    return;
  }
  cb();
};
