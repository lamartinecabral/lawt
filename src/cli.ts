#!/usr/bin/env node

import pkg from "../package.json" with { type: "json" };

if (pkg.version.includes("ollama")) {
  import("./branches/ollama/cli.ts");
} else if (pkg.version.includes("gemma")) {
  import("./branches/gemma/cli.ts");
} else if (pkg.version.includes("openrouter")) {
  import("./branches/openrouter/cli.ts");
}
