import "tsconfig-paths/register";

import { eventsNewCache } from "@replayio/data/src/events/getEventData";
import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { assert } from "@replayio/data/src/util/assert";
import { objectPreviewToJSON } from "@replayio/data/src/util/objectUtil";
import { MappedLocation } from "@replayio/protocol";
import { groupBy } from "lodash";
import { eventCountsCache } from "replay-next/src/suspense/EventsCache";

type EventData = {
  eventType: string;
  frame: MappedLocation | null;
  time: number;
  eventData: Record<string, any>;
};

async function main() {
  const recordingId = "66ae7539-a7d9-455c-8717-bfcf7446fb72";
  const session = await getOrCreateReplaySession(recordingId);

  try {
    const startPoint = BigInt("0");
    const endPoint = BigInt("29531188383048002322689328066592768");

    console.debug(`Fetching events...`);
    const [eventCountsByCategory] = await Promise.all([eventCountsCache.readAsync(session, null)]);

    const uniqueEventTypes = eventCountsByCategory
      .map(c =>
        c.events
          .filter(
            e =>
              e.count &&
              // Cull some noise, for now (later, we can at least add signal edge events).
              !e.type.includes("requestAnimationFrame")
          )
          .flatMap(e =>
            /**
             * @see https://github.com/replayio/devtools/blob/main/packages/replay-next/components/console/filters/EventType.tsx#L46
             */
            e.rawEventTypes.map(rawEventType => ({ eventType: rawEventType, label: e.label }))
          )
      )
      .flat();
    assert(
      uniqueEventTypes.length === new Set(uniqueEventTypes).size,
      `Events are not unique: ${uniqueEventTypes}`
    );

    // 1. Get all event entries.
    console.debug(`Found ${uniqueEventTypes.length} unique events.\nLooking up events...`);
    const eventLogs = (
      await Promise.all(
        uniqueEventTypes.map(async e => {
          const eventLogs = await eventsNewCache.pointsIntervalCache.readAsync(
            startPoint,
            endPoint,
            session,
            e.eventType,
            e.label
          );
          return eventLogs;
        })
      )
    ).flat();

    // 2. Get each event's execution data.
    console.debug(`Getting event data...`);
    const events = (
      await Promise.all(
        eventLogs.map(async eventLog => {
          const { pauseId, values } = await eventsNewCache.resultsCache.readAsync(
            eventLog.point,
            eventLog.eventType,
            eventLog.label
          );
          if (values.length !== 1) {
            // TODO: Handle setTimeout and other events that don't have Event objects.
            console.debug(
              `Could not look up value for eventType=${eventLog.eventType} at point=${eventLog.point}`
            );
            return null;
          }
          const eventData = await objectPreviewToJSON(session, pauseId, values[0]);

          const { eventType, frame, time } = eventLog;
          return {
            eventType,
            frame,
            time,
            eventData,
          };
        })
      )
    ).filter(x => x) as EventData[];

    // console.debug(JSON.stringify(logEntries, null, 2));

    // 3. Summarize groups of events into one entry with count.
    const previewGroups = groupBy(
      events,
      ({ frame, eventData }) => `${JSON.stringify(frame)}, ${JSON.stringify(eventData)}`
    );
    const uniquePreviews = Object.values(previewGroups).map(group => {
      return {
        ...group[0],
        count: group.length,
      };
    });

    // TODO: get event listeners of targets

    console.log(
      `Found ${uniquePreviews.length} unique event entries: ${JSON.stringify(uniquePreviews, null, 2)}`
    );
  } finally {
    session.disconnect();
  }
}

main().catch(console.error);
