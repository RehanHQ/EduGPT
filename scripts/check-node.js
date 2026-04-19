const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (!Number.isFinite(major) || major < 20 || major >= 25) {
  console.error(
    `Unsupported Node.js version: ${process.versions.node}. Use Node 20.x, 22.x, or 24.x for this project.`
  );
  process.exit(1);
}
