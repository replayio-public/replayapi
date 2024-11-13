import { ExecutionPoint } from "@replayio/protocol";

import ReplaySession from "./ReplaySession";


const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
const SymptomPoint: ExecutionPoint = "78858008544042539000621967807086601";

describe("PointQueries", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    console.log("Starting Replay session...");
    session = new ReplaySession();
    await session.initialize(RecordingId);
  });

  test("queryStatement", async () => {
    console.log("Querying point...");
    const point = await session.queryPoint(SymptomPoint);

    // const TODO = await point.queryScopes();
    // TODO
  });
});
