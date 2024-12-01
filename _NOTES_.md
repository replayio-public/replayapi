```sh
NODE_DEBUG=replay:* /replay/replayapi/scripts/run.sh annotate-execution-points /workspace https://github.com/replayio-public/bench-devtools-10609 d6f9492d56ca74548d06e3b0de9ef6a6ddb3ba7d "https://app.replay.io/recording/localhost8080--62d107d5-72fc-476e-9ed4-425e27fe473d"
```

```sh
NODE_DEBUG=replay:* ./scripts/run.sh annotate-execution-points ./workspace-for-testing \
https://github.com/replayio-public/bench-devtools-10609 d6f9492d56ca74548d06e3b0de9ef6a6ddb3ba7d "https://app.replay.io/recording/localhost8080--62d107d5-72fc-476e-9ed4-425e27fe473d"
```
