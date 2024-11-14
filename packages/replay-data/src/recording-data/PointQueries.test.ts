import { ExecutionPoint } from "@replayio/protocol";

import ReplaySession from "./ReplaySession";
import { CodeAtPoint } from "./types";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

type PointExpectations = {
  statement: CodeAtPoint;
}

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

    // TODO: Add rich stack
    // TODO: Add `FunctionInfo`
  },
  "78858008544042539000621967807086601": {
    statement: {
      line: 40,
      url: "webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d",
      code: `return (
      /*BREAK*/<InheritanceRenderer index={index} inheritedSource={item.inheritedSource} style={style} />
    );`,
    },

    // TODO: Add rich stack
    // TODO: Add `FunctionInfo`
  },
};

describe("PointQueries", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    console.log("Starting Replay session...");
    session = new ReplaySession();
    await session.initialize(RecordingId);
  });
  test.each(Object.entries(PointExpectations))(
    "queryStatement for point %s",
    async (point, expected) => {
      console.log("Querying point...");
      const result = await session.queryPoint(point);

      const statement = await result.queryStatement();
      expect({ ...statement }).toStrictEqual(expected.statement);

      // TODO: Add rich stack
      // TODO: Add `FunctionInfo`
    }
  );
});
