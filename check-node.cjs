const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 22 || (minor === 22 && patch < 1) || process.version.includes('-')) {
  throw new Error(`Vyratec requires stable Node.js 24.22.1 or later in the 24.x line; found ${process.version}. Use the version in .node-version.`);
}
console.log(`Vyratec runtime check: Node.js ${process.version}`);
