import fs from "node:fs";

type Pkg = typeof import("../../package.json");

const list = fs.readdirSync("src/branches");

const branches = list.filter((a) => !a.includes("."));

const branch = branches.find((a) => a === process.argv[2]);

if (!branch || !fs.existsSync(`src/branches/${branch}`)) {
  throw new Error(`Valid branches are: ${branches.join(", ")}`);
}

const description: string = JSON.parse(
  fs.readFileSync(`src/branches/${branch}/description.json`).toString(),
);

const setPkgVersion = (pkg: string) => {
  const obj: Pkg = JSON.parse(pkg);
  const currentBranch = obj.version.match(/-(.*)/)?.[1];
  if (!currentBranch) throw new Error("invalid version");
  return pkg.replace(obj.version, obj.version.replace(currentBranch, branch));
};

const setPkgDescription = (pkg: string) => {
  const obj: Pkg = JSON.parse(pkg);
  return pkg.replace(obj.description, description);
};

const pkg = fs.readFileSync("package.json").toString();
fs.writeFileSync("package.json", setPkgVersion(setPkgDescription(pkg)));
