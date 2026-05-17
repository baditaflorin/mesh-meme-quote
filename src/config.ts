import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-meme-quote",
  description: "Peers submit one-liners. Head-to-head pairs, vote, reveal, repeat.",
  accentHex: "#ff7575",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
