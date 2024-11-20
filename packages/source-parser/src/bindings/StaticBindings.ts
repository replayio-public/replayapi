import isString from "lodash/isString";
import { SyntaxNode } from "tree-sitter";

import SourceParser from "../SourceParser";

export interface Declaration {
  name: string;
  declarationNode: SyntaxNode;
  nameNode: SyntaxNode;
}

export type BindingMap = Map<string, Declaration>;

export default class StaticBindings {
  constructor(public readonly parser: SourceParser) {}

  computeNamedDeclarations(node: SyntaxNode): BindingMap {
    const result = new Map<string, Declaration>();

    function addNamedDeclaration(
      declarationNode: SyntaxNode,
      nameNodeOrNameNodeName: SyntaxNode | string
    ) {
      const nameNode = isString(nameNodeOrNameNodeName) ? declarationNode : nameNodeOrNameNodeName;
      const name = nameNode.text;
      result.set(name, { name, declarationNode, nameNode });
    }

    /**
     * Types, Interfaces, Functions, Classes etc. all have a `name` field.
     * Some of them might or might not have bodies.
     * If name has multiple definitions, prefer an overload with body.
     */
    function maybeAddNamedMaybeWithBody(declarationNode: SyntaxNode) {
      const nameNode = declarationNode.childForFieldName("name");
      const name = nameNode?.text;
      if (!name) {
        return;
      }
      const lastDeclaration = result.get(name);
      // Check for overload groups: Pick implementation, or first forward declaration otherwise.
      if (
        lastDeclaration &&
        declarationNode.parent?.id === lastDeclaration.declarationNode.parent?.id &&
        declarationNode.type === lastDeclaration.declarationNode.type
      ) {
        // Prefer implementation over forward declaration.
        const hasBody = declarationNode.childForFieldName("body");
        const lastHasBody = lastDeclaration.declarationNode.childForFieldName("body");
        if (!hasBody && lastHasBody) {
          return;
        }
      }

      addNamedDeclaration(declarationNode, "name");
    }

    /**
     * Variable declarators and parameters, e.g.:
     * const a = 1;
     * let { b, c } = obj;
     * function (a, [b, { c: cc, d }], ...moreArgs) {}
     * import a, { b, c as cc } from "module";
     * ...and more...
     */
    function addIdentifierDescendants(node: SyntaxNode): void {
      // All pattern node names are `identifier` or `shorthand_property_identifier_pattern`.
      const nameNodes = node.descendantsOfType([
        "identifier",
        "shorthand_property_identifier_pattern",
      ]);
      for (const nameNode of nameNodes) {
        addNamedDeclaration(node, nameNode);
      }
    }

    function visit(node: SyntaxNode): void {
      switch (node.type) {
        case "formal_parameters":
        case "variable_declarator":
        case "import_clause":
          addIdentifierDescendants(node);
          break;

        // TODO: Handle declarations not directly owned by scopes.
        // case "getter_declaration":
        // case "setter_declaration":
        // case "property_definition":
        // case "property_signature":
        // case "enum_member":
        //   addNamedDeclaration(node);
        //   break;

        // TODO: Inter-module stuff.
        // case "module_declaration":
        // case "export_statement":
        // case "export_clause":
        //   break;

        default:
          // Handle most named nodes.
          maybeAddNamedMaybeWithBody(node);
          break;
      }

      // Recursively visit children
      node.children.forEach(visit);
    }

    visit(node);
    return result;
  }
}
