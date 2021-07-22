"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = void 0;
const Lint = require("tslint");
class Rule extends Lint.Rules.AbstractRule {
    // override
    apply(sourceFile) {
        // we do not want to apply this rule to backend sources, so we use the simple heuristic to skip it
        // if any part of the filename contains "backend"
        if (-1 !== sourceFile.fileName.indexOf("backend")) {
            return [];
        }
        return this.applyWithWalker(new NoDirectImportWalker(sourceFile, this.getOptions()));
    }
}
exports.Rule = Rule;
Rule.FAILURE_STRING = "Imports from iModeljs modules must come from the index file, not directly from the source file.";
Rule.externalModuleNames = new Set([
    "bentleyjs-core",
    "geometry-core",
    "bwc",
    "imodeljs-i18n",
    "imodeljs-clients",
    "imodeljs-common",
    "imodeljs-quantity",
    "imodeljs-frontend",
    "ui-abstract",
    "ui-core",
    "ui-components",
    "ui-framework",
    "ui-ninezone",
    "presentation-common",
    "presentation-components",
    "presentation-frontend",
]);
class NoDirectImportWalker extends Lint.RuleWalker {
    // override
    visitImportDeclaration(node) {
        const from = node.moduleSpecifier.getText().slice(1, -1);
        // it is Ok to import scss files from another package - they're not in the index file.
        if (!from.endsWith(".scss")) {
            // divide the string at the / characters.
            const pathComponents = from.split("/", 3);
            if ((pathComponents.length > 2) && (pathComponents[0] === "@bentley")) {
                if (Rule.externalModuleNames.has(pathComponents[1])) {
                    this.addFailureAtNode(node, Rule.FAILURE_STRING);
                }
            }
        }
        super.visitImportDeclaration(node);
    }
}
