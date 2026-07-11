import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { resolveBuildOutput } from "../scripts/build-paths.mjs";

test("build output resolver permits only dist and named calculator temp folders", () => {
  const root = resolve("/workspace/fiber-loss-calculator");
  assert.equal(resolveBuildOutput(root), resolve(root, "dist"));
  assert.equal(
    resolveBuildOutput(root, resolve(tmpdir(), "fiber-loss-calculator-release")),
    resolve(tmpdir(), "fiber-loss-calculator-release"),
  );
  assert.throws(() => resolveBuildOutput(root, root), /Unsafe BUILD_DIR/);
  assert.throws(() => resolveBuildOutput(root, resolve(root, "src")), /Unsafe BUILD_DIR/);
  assert.throws(() => resolveBuildOutput(root, tmpdir()), /Unsafe BUILD_DIR/);
  assert.throws(() => resolveBuildOutput(root, resolve(tmpdir(), "unrelated")), /Unsafe BUILD_DIR/);
});
