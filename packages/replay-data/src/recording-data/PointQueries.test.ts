import { ExecutionPoint } from "@replayio/protocol";

import ReplaySession from "./ReplaySession";

/**
 * Debugging recordingId used only during early development.
 */
const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
const SymptomPoint: ExecutionPoint = "78858008544042601258383216576823298";

describe("PointQueries", () => {
  test("queryStatement", async () => {
    console.log("Starting Replay session...");
    const session = new ReplaySession();
    await session.initialize(RecordingId);

    console.log("Querying point...");
    const point = await session.queryPoint(SymptomPoint);

    const { line, url, code } = await point.queryStatement();
    expect(line).toBe(151);
    expect(url).toBe("webpack://_N_E/src/devtools/client/inspector/markup/components/rules/RulesListItem.tsx?6a8d");
    expect(code).toBe(`return (
    /*BREAK*/<div className={styles.Inheritance} data-list-index={index} style={style}>
      {inheritedSource}
    </div>
  );`);
  });
});
