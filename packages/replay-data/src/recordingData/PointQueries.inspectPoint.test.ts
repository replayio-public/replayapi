import { ExecutionPoint } from "@replayio/protocol";

import { getReplaySessionForTest } from "../../testing/sessions";
import ReplaySession from "./ReplaySession";
import { InspectPointResult } from "./types";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

const PointExpectations: Record<ExecutionPoint, InspectPointResult> = {
  "78858008544042601258383216576823298": {
    location: {
      line: 151,
      url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d",
      code: "return (\n    /*POINT*/<div className={styles.Inheritance} data-list-index={index} style={style}>\n      {inheritedSource}\n    </div>\n  );",
      functionName: "InheritanceRenderer",
    },
    function: {
      name: "InheritanceRenderer",
      lines: {
        start: 141,
        end: 155,
      },
      params:
        "({\n  index,\n  inheritedSource,\n  style,\n}: {\n  index: number;\n  inheritedSource: string;\n  style: CSSProperties;\n})",
    },
    inputDependencies: [
      {
        expression: "index",
        value: "7",
        type: "number",
        staticBinding: {
          kind: "param",
        },
      },
      {
        expression: "style",
        value:
          '{"position": "absolute", "left": 0, "right": undefined, "top": 140, "height": 20, "width": "100%"}',
        type: "object",
        staticBinding: {
          kind: "param",
        },
      },
      {
        expression: "inheritedSource",
        value: '"Inherited from iframe"',
        type: "string",
        staticBinding: {
          kind: "param",
        },
      },
    ],
    stackAndEvents: [
      {
        kind: "ReactCreateElement",
        point: "78858008544042539000621967807086602",
        functionName: "RulesListItem",
        line: 40,
        url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d",
        code: "return (\n      /*POINT*/<InheritanceRenderer index={index} inheritedSource={item.inheritedSource} style={style} />\n    );",
      },
      {
        kind: "ReactCreateElement",
        point: "78858008544035975418496241027252267",
        functionName: "GenericList",
        line: 216,
        url: "webpack://_N_E/packages/replay-next/components/windowing/GenericList.tsx?9746",
        code: "return (\n    /*POINT*/<List<GenericListItemData<Item, ItemData>>\n      children={itemRendererComponent}\n      className={className}\n      height={height}\n      itemCount={itemCount}\n      itemData={{\n        itemData,\n        listData,\n        revision,\n        selectedItemIndex,\n      }}\n      itemSize={itemSize}\n      onItemsRendered={onItemsRendered}\n      outerRef={outerRef}\n      ref={listRef}\n      style={style}\n      width={width}\n    />\n  );",
      },
      {
        kind: "ReactCreateElement",
        point: "78858008544035673353062034033344525",
        functionName: "RulesList",
        line: 38,
        url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesList.tsx?7810",
        code: 'return (\n    /*POINT*/<GenericList\n      dataTestId="RulesList"\n      fallbackForEmptyList={noContentFallback}\n      height={height}\n      itemData={itemData}\n      itemRendererComponent={RulesListItem}\n      itemSize={ITEM_SIZE}\n      listData={rulesListData}\n      width="100%"\n    />\n  );',
      },
      {
        kind: "ReactCreateElement",
        point: "78858008544035498108993299432865798",
        functionName: "RulesPanelSuspends",
        line: 70,
        url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesPanel.tsx?8b1e",
        code: 'return (\n    <div\n      className={styles.RulesPanel}\n      data-test-id="RulesPanel"\n      data-is-pending={isPending || undefined}\n    >\n      <div className={styles.FilterRow}>\n        <Icon className={styles.FilterIcon} type="filter" />\n        <input\n          className={styles.FilterInput}\n          onChange={({ target }) => setSearchText(target.value)}\n          placeholder="Find Styles"\n          value={searchText}\n        />\n      </div>\n      <div className={styles.ListWrapper}>\n        <AutoSizer disableWidth>\n          {({ height }: { height: number }) => (\n            <RulesList\n              height={height}\n              noContentFallback={\n                /*POINT*/<div className={styles.NoStyles}>\n                  {selectedNodeId ? "No styles to display" : "No element selected"}\n                </div>\n              }\n              rules={cachedStyles?.rules ?? NO_RULES_AVAILABLE}\n              searchText={searchText}\n            />\n          )}\n        </AutoSizer>\n      </div>\n    </div>\n  );',
      },
      {
        kind: "ReactCreateElement",
        point: "78858008544017059435370397007085612",
        functionName: "RulesPanelSuspends",
        line: 65,
        url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesPanel.tsx?8b1e",
        code: 'return (\n    <div\n      className={styles.RulesPanel}\n      data-test-id="RulesPanel"\n      data-is-pending={isPending || undefined}\n    >\n      <div className={styles.FilterRow}>\n        <Icon className={styles.FilterIcon} type="filter" />\n        <input\n          className={styles.FilterInput}\n          onChange={({ target }) => setSearchText(target.value)}\n          placeholder="Find Styles"\n          value={searchText}\n        />\n      </div>\n      <div className={styles.ListWrapper}>\n        /*POINT*/<AutoSizer disableWidth>\n          {({ height }: { height: number }) => (\n            <RulesList\n              height={height}\n              noContentFallback={\n                <div className={styles.NoStyles}>\n                  {selectedNodeId ? "No styles to display" : "No element selected"}\n                </div>\n              }\n              rules={cachedStyles?.rules ?? NO_RULES_AVAILABLE}\n              searchText={searchText}\n            />\n          )}\n        </AutoSizer>\n      </div>\n    </div>\n  );',
      },
      {
        kind: "PromiseSettled",
        point: "78858008544010399007838635439423488",
        functionName: "cssRulesCache.load",
        line: 302,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "return {\n      elementStyle,\n      rules: elementStyle.rules?.map(rule => getRuleState(/*POINT*/rule)) ?? [],\n    };",
      },
      {
        kind: "PromiseSettled",
        point: "78858008544006971372205439283363840",
        functionName: "ElementStyle.onRuleUpdated",
        line: 215,
        url: "webpack://_N_E/src/devtools/client/inspector/rules/models/element-style.ts?7f47",
        code: "{\n    this.updateDeclarations();\n\n    // Update declarations for matching rules for pseudo-elements.\n    for (const pseudo of this.pseudoElements) {\n      this.updateDeclarations(pseudo);\n    }\n  /*POINT*/}",
      },
      {
        kind: "PromiseSettled",
        point: "78208971436560523776913820377677854",
        functionName: "appliedRulesCache.load",
        line: 187,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "return /*POINT*/wiredRules;",
      },
      {
        kind: "PromiseSettled",
        point: "78208971436560515706463288129749019",
        functionName: "appliedRulesCache.load",
        line: 178,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "await Promise./*POINT*/all(stylePromises);",
      },
      {
        kind: "PromiseSettled",
        point: "77559934329212232459759888833183750",
        functionName: "ReplayClient.getObjectWithPreview",
        line: 739,
        url: "webpack://_N_E/packages/shared/client/ReplayClient.ts?2a2d",
        code: "return result./*POINT*/data;",
      },
    ],
    stackAndEventsTruncated: true,
  },
  "78858008544010399007838635439423488": {
    location: {
      line: 302,
      url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
      code: "return {\n      elementStyle,\n      rules: elementStyle.rules?.map(rule => getRuleState(/*POINT*/rule)) ?? [],\n    };",
      functionName: "cssRulesCache.load",
    },
    function: {
      name: "cssRulesCache.load.rules.<anonymous>",
      lines: {
        start: 302,
        end: 302,
      },
      params: "",
    },
    inputDependencies: [],
    stackAndEvents: [
      {
        kind: "StackFrame",
        point: "78858008544006974830969978873708558",
        functionName: "cssRulesCache.load",
        line: 302,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "return {\n      elementStyle,\n      rules: elementStyle.rules?./*POINT*/map(rule => getRuleState(rule)) ?? [],\n    };",
      },
      {
        kind: "PromiseSettled",
        point: "78858008544006971372205439283363840",
        functionName: "ElementStyle.onRuleUpdated",
        line: 215,
        url: "webpack://_N_E/src/devtools/client/inspector/rules/models/element-style.ts?7f47",
        code: "{\n    this.updateDeclarations();\n\n    // Update declarations for matching rules for pseudo-elements.\n    for (const pseudo of this.pseudoElements) {\n      this.updateDeclarations(pseudo);\n    }\n  /*POINT*/}",
      },
      {
        kind: "PromiseSettled",
        point: "78208971436560523776913820377677854",
        functionName: "appliedRulesCache.load",
        line: 187,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "return /*POINT*/wiredRules;",
      },
      {
        kind: "PromiseSettled",
        point: "78208971436560515706463288129749019",
        functionName: "appliedRulesCache.load",
        line: 178,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "await Promise./*POINT*/all(stylePromises);",
      },
      {
        kind: "PromiseSettled",
        point: "77559934329212232459759888833183750",
        functionName: "ReplayClient.getObjectWithPreview",
        line: 739,
        url: "webpack://_N_E/packages/shared/client/ReplayClient.ts?2a2d",
        code: "return result./*POINT*/data;",
      },
      {
        kind: "PromiseSettled",
        point: "77559934329212231306838384226336800",
        functionName: "sendMessage",
        line: 249,
        url: "webpack://_N_E/packages/protocol/socket.ts?32fa",
        code: "return response./*POINT*/result as any;",
      },
      {
        kind: "PromiseSettled",
        point: "77559934329212230153916810900013072",
        functionName: "socketDataHandler",
        line: 335,
        url: "webpack://_N_E/packages/protocol/socket.ts?32fa",
        code: "/*POINT*/resolve(msg);",
      },
      {
        kind: "PromiseSettled",
        point: "76586378668104347859636559659663390",
        functionName: "appliedRulesCache.load",
        line: 187,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "return /*POINT*/wiredRules;",
      },
      {
        kind: "PromiseSettled",
        point: "76586378668104339789186027411734555",
        functionName: "appliedRulesCache.load",
        line: 178,
        url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
        code: "await Promise./*POINT*/all(stylePromises);",
      },
      {
        kind: "PromiseSettled",
        point: "75937341560764077417390177949581318",
        functionName: "ReplayClient.getObjectWithPreview",
        line: 739,
        url: "webpack://_N_E/packages/shared/client/ReplayClient.ts?2a2d",
        code: "return result./*POINT*/data;",
      },
    ],
    stackAndEventsTruncated: true,
  },

  // "78858008544010354043899912822718466": {
  //   statement: {
  //     line: 250,
  //     url: "webpack://_N_E/src/ui/suspense/styleCaches.ts?52eb",
  //     code: `return /*POINT*/{
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
      const qp = await session.queryPoint(point);

      const res = await qp.inspectPoint();
      expect(res).toEqual(expected);
    }
  );
});
