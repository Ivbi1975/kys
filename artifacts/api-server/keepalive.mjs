import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function start() {
  const proc = spawn(
    "node",
    ["--enable-source-maps", "./dist/index.mjs"],
    {
      cwd: __dirname,
      stdio: "inherit",
      env: { ...process.env },
      detached: false,
    }
  );

  proc.on("exit", (code, signal) => {
    process.stderr.write(
      `[keepalive] exited code=${code} signal=${signal} — restarting in 1s\n`
    );
    setTimeout(start, 1000);
  });
}

// Prevent Node from exiting when there are no active handles
setInterval(() => {}, 1 << 30);

start();
