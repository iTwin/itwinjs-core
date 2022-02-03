/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Compiler } from "webpack";
import { getSourcePosition } from "../utils/paths";

/**
 * Plugin to help our backends cleanly compile (without warnings) by default.
 *
 * Some third-party dependencies will attempt to require optional packages that they do not include.
 * Others use `require` in a way that prevents webpack from parsing the import (i.e. passing a variable instead of string literal);
 *
 * This plugin attempts to solve both cases by allowing us to pass a list of *npm packages* that should be specially handled.
 * For all JS files within one of these packages, the following cases will be completely ignored by webpack:
 *  - Any call to `require()` wrapped in a try/catch block
 *  - Any call to `require()` where the argument is an expression which cannot be statically resolved
 *    - NB that not all JS expressions will trigger this case.  Something like `"foo" + "bar"` can still be treated by webpack as if it were just `"foobar"`.
 *  - Any non-call use of require (assigning it to another variable, etc.)
 *
 * Ignoring these calls to `require` means that the statement will be left - unmodified - in the resulting bundle.
 * Thus, such optional dependencies can still be used so long as they are installed and discoverable via normal node module resolution at runtime.
 */
export class IgnoreOptionalDependenciesPlugin {
  private _requestRegex: RegExp;
  constructor(packages: string[]) {
    this._requestRegex = new RegExp(`[\\\\\\/]node_modules[\\\\\\/](${packages.map(escapeRegex).join("|")})[\\\\\\/]`);
  }

  public apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap("IgnoreOptionalDependenciesPlugin", (nmf) => {
      nmf.hooks.parser.for("javascript/auto").tap("IgnoreOptionalDependenciesPlugin", (parser: any) => {
        parser.hooks.call.for("require").tap("IgnoreOptionalDependenciesPlugin", (expr: any) => {
          if (expr.arguments.length !== 1)
            return;

          if (!this._requestRegex.test(parser.state.current.request))
            return;

          const logger = parser.state.compilation.getLogger("IgnoreOptionalDependenciesPlugin");
          const param = parser.evaluateExpression(expr.arguments[0]);
          if (param.isString()) {
            if (!parser.scope.inTry)
              return;

            logger.log(`Ignoring require("${param.string}") at ${getSourcePosition(parser.state.current, expr.loc)}`);
            return true;
          }

          logger.log(`Ignoring require(<<expression>>) at ${getSourcePosition(parser.state.current, expr.loc)}`);
          return true;
        });
        parser.hooks.expression.for("require").tap("IgnoreOptionalDependenciesPlugin", (expr: any) => {
          if (!this._requestRegex.test(parser.state.current.request))
            return;

          const logger = parser.state.compilation.getLogger("IgnoreOptionalDependenciesPlugin");
          logger.log(`Ignoring non-call require expression at ${getSourcePosition(parser.state.current, expr.loc)}`);
          return true;
        });
      });
    });
  }
}

function escapeRegex(str: string) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
