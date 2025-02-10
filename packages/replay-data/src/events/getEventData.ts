import { EventHandlerType, PointDescription, PointSelector } from "@replayio/protocol";
import { createAnalysisCache } from "replay-next/src/suspense/AnalysisCache";
import { EventLog, eventPointsCache } from "replay-next/src/suspense/EventsCache";

export const eventsNewCache = createAnalysisCache<EventLog, [EventHandlerType, string]>(
  "EventsNew",
  eventType => eventType,
  (client, begin, end, eventType, label) =>
    eventPointsCache.readAsync(BigInt(begin), BigInt(end), client, [eventType, label]),
  async (client, points, eventType) => {
    const expression = `(() => {
              const args = __RECORD_REPLAY__.getFrameArgumentsArray();
              const e = args.find(a => a instanceof Event && a.target);
              if (e && e.target) {
                return [{
                  id: __RECORD_REPLAY_ARGUMENTS__.getPersistentId(e.target),
                  rect: e.target?.getBoundingClientRect?.(),
                  innerHTML: e.target?.innerHTML,
                }];
              };
              return []; // emtpy array
            })()`;

    return {
      selector: createPointSelector([eventType]),
      expression,
      frameIndex: 0,
    };
  },
  transformPoint
);

function createPointSelector(eventTypes: EventHandlerType[]): PointSelector {
  return { kind: "event-handlers", eventTypes };
}

function transformPoint(
  point: PointDescription,
  eventType: EventHandlerType,
  label: string
): EventLog {
  return { ...point, label, eventType, type: "EventLog" };
}
