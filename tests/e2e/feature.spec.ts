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

test("a vote + reveal on peer A propagates the winner and tally to peer B", async ({
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

    // Both peers reach the head-to-head arena with the same two cards.
    await expect(a.locator(".meme-arena .meme-card")).toHaveCount(2);
    await expect(b.locator(".meme-arena .meme-card")).toHaveCount(2);

    // Peer A casts the advertised core action: a vote. Alice can only vote for
    // the card she did NOT author, so the single enabled vote button is bob's.
    const aliceVoteBtn = a.locator(".meme-card:not(:has-text('alice')) .meme-vote");
    await expect(aliceVoteBtn).toBeEnabled();
    const votedCard = a.locator(".meme-card", { has: a.locator(".meme-vote") }).filter({
      hasText: "mesh is magic",
    });
    await aliceVoteBtn.click();
    await expect(votedCard.locator(".meme-vote")).toContainText(/voted/i);

    // Peer A advances the phase: reveal.
    await a.getByRole("button", { name: "reveal", exact: true }).click();

    // ── Cross-peer assertion: peer B (who never voted, never revealed) must
    // see the winner trophy AND the synced vote tally for the card peer A
    // voted on. This proves both the vote (Y.Map) and the reveal phase
    // transition (usePhase) crossed the mesh to the OPPOSITE peer.
    const bWinnerCard = b.locator(".meme-card").filter({ hasText: "mesh is magic" });
    await expect(bWinnerCard.locator(".meme-trophy")).toContainText(/winner/i);
    await expect(bWinnerCard.locator(".meme-bar")).toContainText("100%");
    // The card peer A did NOT vote for shows 0 on peer B.
    const bLoserCard = b.locator(".meme-card").filter({ hasText: "hello world" });
    await expect(bLoserCard.locator(".meme-bar")).toContainText(/^0 ·/);
  } finally {
    await cleanup();
  }
});
