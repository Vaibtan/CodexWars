import appConfig from "./app.config.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
void appConfig.listen(port, "0.0.0.0", undefined, () => {
  console.log(`CodexWars server listening on http://localhost:${port}`);
});
