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
      point: "78858008544035673353062034033344525",
      expression: "itemData",
    },
    expected: {
      get value() {
        return {
          // NOTE: The stringifier util calls JSON.stringify on string values.
          type: 'object',
          value: expect.stringMatching(
            /rules.*?declarations.*?selector.*?getUniqueSelector.*?length/s
          ),
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
      const result = await pq.makeValuePreview(expression);
      expect(result).toEqual(expected.value);

      // TODO: expect on dataFlow data
      // const dataFlow = await pq.runDataFlowAnalysis();
      // expect(dataFlow.variablePointsByName["itemData"]).toEqual([
      //   {
      //     value: TODO,
      //     contents: TODO,
      //     associatedPoint: TODO,
      //     associatedLocation: TODO,
      //   },
      // ]);
    }
  );
});
