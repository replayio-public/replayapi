import { getReplaySessionForTest } from "../../testing/sessions";
import { AnalysisType, DependencyGraphMode } from "./dependencyGraphShared";
import { AnalysisInput } from "./dgSpecs";
import { runAnalysisExperimentalCommand } from "./runAnalysis";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
const Point = "78858008544042601258383216576823298";

describe("run-analysis", () => {
  test(`basic ${AnalysisType.Dependency}`, async () => {
    const spec = {
      recordingId: RecordingId,
      point: Point,
      mode: DependencyGraphMode.ReactOwnerRenders,
    };
    const input: AnalysisInput = {
      analysisType: AnalysisType.Dependency,
      spec,
    };
    const session = await getReplaySessionForTest(RecordingId);
    const result1 = await runAnalysisExperimentalCommand(session, input);
    expect(result1.dependencies.slice(-4)).toEqual([
      {
        code: "ReactCreateElement",
        time: expect.any(Number),
        point: "78858008544036365105964798141530147",
        functionLocation: expect.any(Object),
        functionName: "createListComponent",
      },
      {
        code: "ReactRender",
        time: expect.any(Number),
        point: "78858008544042494036683288140054530",
        functionLocation: expect.any(Object),
        functionName: "RulesListItem",
      },
      {
        code: "ReactCreateElement",
        time: expect.any(Number),
        point: "78858008544042539000621967807086602",
        functionLocation: expect.any(Object),
        functionName: "RulesListItem",
      },
      {
        code: "ReactRender",
        time: expect.any(Number),
        point: "78858008544042601258383216576823298",
        functionLocation: expect.any(Object),
        functionName: "InheritanceRenderer",
      },
    ]);
  });

  // test(`basic ${AnalysisType.ExecutionPoint}`, async () => {
  //   const input: AnalysisInput<AnalysisType.ExecutionPoint> = {
  //     analysisType: AnalysisType.ExecutionPoint,
  //     spec: {
  //       recordingId: "62d107d5-72fc-476e-9ed4-425e27fe473d",
  //       point: "30180225493450815051110582436495362",
  //       depth: 2,
  //     },
  //   };

  //   const session = await getReplaySessionForTest(input.spec.recordingId);
  //   const result1 = await runAnalysisExperimentalCommand(session, input);
  //   expect(result1).toEqual({
  //     points: [
  //       {
  //         point: "30180225493450815051110582436495362",
  //         location: expect.any(Object),
  //         entries: expect.any(Array),
  //       },
  //       {
  //         point: "30180225493450046052467009669562382",
  //         location: expect.any(Object),
  //         entries: expect.any(Array),
  //       },
  //       {
  //         point: "25636965741867309418954184485503028",
  //         location: expect.any(Object),
  //         entries: expect.any(Array),
  //       },
  //       {
  //         point: "30180225493447522307293390921793539",
  //         location: expect.any(Object),
  //         entries: [],
  //       },
  //     ],
  //   });
  // });

  // test(`basic ${AnalysisType.Performance}`, async () => {
  //   const input: AnalysisInput<AnalysisType.Performance> = {
  //     analysisType: AnalysisType.Performance,
  //     spec: {
  //       recordingId: "87db126a-82cf-4477-b244-b57a118d0b1b",
  //     },
  //   };

  //   const session = await getReplaySessionForTest(input.spec.recordingId);
  //   const result1 = await runAnalysisExperimentalCommand(session, input);
  // });
});
