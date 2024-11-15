import isString from "lodash/isString";
import { SyntaxNode } from "tree-sitter";

const DefaultFunctionName = "<anonymous>";

export function guessFunctionName(functionNode: SyntaxNode): string | null {
  const names: (string | undefined)[] = [];

  const nameNode = functionNode.childForFieldName("name");
  let newName = nameNode?.text;
  if (isString(newName)) {
    names.push(newName);
    newName = undefined;
  }
  let parent: SyntaxNode | null = functionNode.parent;

  function registerName() {
    if (isString(newName)) {
      // Found a new name: add it to the list.
      // NOTE: We generally add the result of the previous iteration here.
      // This works because the AST of a program is assured to always have a `Program`, which assures one more iteration after
      // any named node was found.
      names.push(newName);
      newName = undefined;
    }
  }

  while (parent) {
    switch (parent.type) {
      case "variable_declarator":
      case "public_field_definition": {
        const idNode = parent.childForFieldName("name");
        newName = idNode?.text;
        break;
      }

      case "pair": {
        const keyNode = parent.childForFieldName("key");
        newName = keyNode?.text;
        break;
      }

      case "assignment_expression": {
        let leftNode = parent.childForFieldName("left");
        if (leftNode?.type === "member_expression") {
          const objNode = leftNode.childForFieldName("object");
          const propNode = leftNode.childForFieldName("property");
          if (objNode?.type === "this") {
            // Ignore `this`
            leftNode = propNode;
          }
        }
        newName = leftNode?.text;
        break;
      }

      case "class":
      case "class_declaration": {
        const idNode = parent.childForFieldName("name");
        newName = idNode?.text;
        break;
      }

      default:
        // Register name only if not a new name was found.
        // In case of conflict (e.g. `x = class A { y = function f() { } }`),
        // we generally want to register the inner-most name,
        // which is the name from the previous iteration.
        registerName();
        if (!parent) {
          break;
        }
    }
    if (!names.length && !isString(newName)) {
      // First iteration: Make sure the function is given the default name, if no direct name was found.
      newName = DefaultFunctionName;
    }

    parent = parent?.parent || null;
  }

  return (
    names
      .filter(n => isString(n))
      .reverse()
      .join(".") || DefaultFunctionName
  );
}
