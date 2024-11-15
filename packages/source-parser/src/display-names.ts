import { SyntaxNode } from "tree-sitter";

const DefaultFunctionName = "<anonymous>";

export function guessFunctionName(functionNode: SyntaxNode): string | null {
  const names: (string | undefined)[] = [];

  const nameNode = functionNode.childForFieldName("name");
  if (nameNode) {
    names.push(nameNode.text || "");
  }

  let parent = functionNode.parent;

  let foundIntrinsicName = !!names.length;
  if (foundIntrinsicName && parent) {
    // If the function itself has a name, then skip its parent's name.
    // E.g.: `var xyz = function f() {}` should yield `f`, not `xyz.f`.
    parent = parent.parent;
  }

  while (parent) {
    switch (parent.type) {
      case "variable_declarator":
      case "public_field_definition": {
        const idNode = parent.childForFieldName("name");
        names.push(idNode?.text);
        break;
      }

      case "pair": {
        const keyNode = parent.childForFieldName("key");
        names.push(keyNode?.text);
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
        names.push(leftNode?.text);
        break;
      }
      case "class":
      case "class_declaration": {
        const idNode = parent.childForFieldName("name");
        names.push(idNode?.text);
        break;
      }
    }
    if (!foundIntrinsicName) {
      if (!names.length) {
        // If we have not found a name in the direct parent, give it default name.
        names.push(DefaultFunctionName);
      }
      foundIntrinsicName = true;
    }
    parent = parent.parent!;
  }

  return names.reverse().join(".") || DefaultFunctionName;
}
