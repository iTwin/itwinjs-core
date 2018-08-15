// ====================================================================================================================
/**
 * This rule enforces that all private and protected properties of a class are prefixed with an underscore.
 */
// ====================================================================================================================
import * as ts from "typescript";
import * as Lint from "tslint";

export class Rule extends Lint.Rules.AbstractRule {
  public static FAILURE_STRING: string = "Private properties must be prefixed with an underscore.";

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new PrivateUnderscoresWalker(sourceFile, this.getOptions()),
    );
  }
}

class PrivateUnderscoresWalker extends Lint.RuleWalker {
  // override
  public visitPropertyDeclaration(node: ts.PropertyDeclaration) {
    if (this.isPublic(node))
      return;

    const name = node.name.getText();
    if (name[0] !== "_")
      this.addFailureAtNode(node, Rule.FAILURE_STRING);
  }

  private isPublic(node: ts.PropertyDeclaration): boolean {
    if (node.modifiers === undefined)
      return true;  // assume no modifiers means public by default
    for (const modifier of node.modifiers) {
      const modText = modifier.getText();
      if (modText === "public")
        return true;
    }
    return false;
  }
}
