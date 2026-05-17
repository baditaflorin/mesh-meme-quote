import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("two peers submit quotes and head-to-head arena renders on both", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(400);

    await a.getByPlaceholder("your quote").fill("hello world");
    await a.getByRole("button", { name: "submit quote", exact: true }).click();
    await b.getByPlaceholder("your quote").fill("mesh is magic");
    await b.getByRole("button", { name: "submit quote", exact: true }).click();
    await b.waitForTimeout(400);

    await expect(b.locator(".meme-arena .meme-card")).toHaveCount(2);
    await expect(b.locator(".meme-arena")).toContainText("hello world");
    await expect(b.locator(".meme-arena")).toContainText("mesh is magic");
  } finally {
    await cleanup();
  }
});
