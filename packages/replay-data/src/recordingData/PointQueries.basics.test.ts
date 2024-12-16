import { ExecutionPoint } from "@replayio/protocol";

import { getReplaySessionForTest } from "../../testing/sessions";
import ReplaySession from "./ReplaySession";
import { CodeAtLocation } from "./types";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

type PointExpectations = {
  statement: CodeAtLocation;
  scopes: any[];
  richStack: any[];
};

const PointExpectations: Record<ExecutionPoint, PointExpectations> = {
  "78858008544042601258383216576823298": {
    statement: {
      line: 151,
      url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d",
      code: `return (
    /*BREAK*/<div className={styles.Inheritance} data-list-index={index} style={style}>
      {inheritedSource}
    </div>
  );`,
    },
    scopes: [],
    richStack: [
      // TODO: Add rich stack
      // 78858008544010399007838635439423488
    ],
    // TODO: Add `FunctionInfo`
  },

  // "78858008544042539000621967807086601": {
  //   statement: {
  //     line: 40,
  //     url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d",
  //     code: `return (
  //     /*BREAK*/<InheritanceRenderer index={index} inheritedSource={item.inheritedSource} style={style} />
  //   );`,
  //   },
  //   // TODO: Add rich stack
  //   // TODO: Add `FunctionInfo`
  // },

  // "78858008544010354043899912822718466": {
  //   statement: {
  //     line: 250,
  //     url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
  //     code: `return /*BREAK*/{
  //   // Array of CSS declarations.
  //   declarations: rule.declarations.map(declaration =>
  //     getDeclarationState(declaration, rule.domRule.objectId())
  //   ),
  //   // An unique CSS rule id.
  //   id: rule.domRule.objectId(),
  //   // An object containing information about the CSS rule's inheritance.
  //   inheritance: rule.inheritance,
  //   // Whether or not the rule does not match the current selected element.
  //   isUnmatched: rule.isUnmatched,
  //   // Whether or not the rule is an user agent style.
  //   isUserAgentStyle: rule.domRule.isSystem,
  //   // An object containing information about the CSS keyframes rules.
  //   // keyframesRule: rule.keyframesRule,
  //   // The pseudo-element keyword used in the rule.
  //   pseudoElement: rule.pseudoElement,
  //   // An object containing information about the CSS rule's selector.
  //   selector: rule.selector,
  //   // An object containing information about the CSS rule's stylesheet source.
  //   sourceLink: rule.sourceLink,
  //   // The type of CSS rule.
  //   type: rule.domRule.type,
  // };`,
  //   // TODO: Add rich stack
  //   // TODO: Add `FunctionInfo`
  //   },
};

describe("PointQueries basics", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });
  test.each(Object.entries(PointExpectations))(
    "queryStatement for point %s",
    async (point, expected) => {
      const result = await session.queryPoint(point);

      const statement = await result.queryCodeAndLocation();
      expect({ ...statement }).toStrictEqual(expected.statement);

      const scopes = await result.queryDynamicScopes();
      const allStaticBindings = [];
      const allMatchingDynamicBindings = [];
      for (const scope of scopes) {
        const staticNames = Array.from(scope.staticScope.declarations.values()).map(s => s.name);
        const dynamicNames = scope.dynamicBindings.map(b => b.name);
        const prefix = [scope.staticScope.node.type];
        allStaticBindings.push(prefix.concat(staticNames.sort()));
        allMatchingDynamicBindings.push(prefix.concat(dynamicNames.sort()));
      }

      // TODO: Explicitely define and assert on bindings that we see both statically and dynamically.
      // expect(allMatchingDynamicBindings).toEqual(allStaticBindings);

      // const functionInfo = await result.queryFunctionInfo();
      // console.log("functionInfo:", functionInfo);
    }
  );
});
