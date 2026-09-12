import fs from "node:fs";
import path from "node:path";

export const abortables = new Set<{ abort: () => unknown }>();

export const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return str.substring(0, len - 1) + "…";
  return str;
};

export const projectRoot = path.resolve(
  path.dirname(fs.realpathSync(process.argv[1])),
  "..",
);
