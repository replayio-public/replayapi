import { getApiKey } from "../../recording-data/ReplaySession";
import { DependencyGraphMode } from "./dg-types";
import { DGAnalyzeDependencies } from "./dependency-graph";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
const Point = "78858008544042601258383216576823298";

describe("dg-wrapper", () => {
  test("DGAnalyzeDependencies", async () => {
    const spec = {
      recordingId: RecordingId,
      point: Point,
      mode: DependencyGraphMode.ReactOwnerRenders,
      showPromises: true,
    };
    const options = {
      apiKey: getApiKey(),
      spec,
    };
    const result = await DGAnalyzeDependencies(options);
    // TODO: expect
  });
});
