import { ExecutionPoint } from "@replayio/protocol";

import { getReplaySessionForTest } from "../../testing/sessions";
import ReplaySession from "./ReplaySession";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

type TestData = {
  query: {
    point: ExecutionPoint;
    expression: string;
  };
  expected: {
    value: any;
  };
};

const PointExpectations: TestData[] = [
  {
    query: {
      point: "78858008544010399007838635439423488",
      expression: "elementStyle.rules",
    },
    expected: {
      get value() {
        return {
          expression: "elementStyle.rules",
          type: "Array",
          value: expect.stringMatching(
            /pauseId": "6eebc384-457d-4b35-ac01-dfef9f5ddf80.*_sessionId": "82e71ad8-383f-4efc-8e8c-880b020fc637.*_dispatchURL": "wss:\/\/dispatch\.replay\.io/s
          ),
          staticBinding: undefined,
          origins: [
            {
              point: "67175340610898351232456180199587842",
              location: {
                code: "this.rules = [];",
                url: "webpack://_N_E/src/devtools/client/inspector/rules/models/element-style.ts?7f47",
                line: 67,
                functionName: "ElementStyle.populate",
              },
            },
          ],
        };
      },
    },
  },
  {
    query: {
      point: "78858008544035673353062034033344525",
      expression: "itemData",
    },
    expected: {
      get value() {
        return {
          expression: "itemData",
          // NOTE: The stringifier util calls JSON.stringify on string values.
          type: "object",
          value: expect.stringMatching(
            /rules.*?declarations.*?selector.*?getUniqueSelector.*?length/s
          ),
          staticBinding: {
            kind: "const",
            declaration: expect.objectContaining({
              code: expect.stringMatching(/const itemData = useMemo/),
              line: 27,
            }),
          },
          origins: [], // TODO
        };
      },
    },
  },
  {
    query: {
      point: "78858008544042601258383216576823300",
      expression: "inheritedSource",
    },
    expected: {
      get value() {
        return {
          expression: "inheritedSource",
          type: "string",
          value: '"Inherited from iframe"',
          staticBinding: {
            kind: "param",
          },
          origins: [], // TODO
        };
      },
    },
  },
];

describe("PointQueries values", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });
  test.each(PointExpectations)(
    "queryStatement for point %s",
    async ({ query: { point, expression }, expected }) => {
      const pq = await session.queryPoint(point);
      const result = await pq.queryExpressionInfo(expression);
      expect(result).toEqual(expected.value);
    }
  );
});
