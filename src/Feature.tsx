import {
  Leaderboard,
  MeshNameInput,
  MeshToasts,
  useEventLog,
  useFairRng,
  useNamedPeer,
  usePhase,
  useRoster,
  useVotes,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";
import { useState } from "react";

type Quote = { id: string; peerId: string; text: string; ts: number };
type Props = { room: YRoom | null; config: MeshConfig };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="meme-screen">
        <h1>{config.appName}</h1>
        <p className="meme-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const quotes = useEventLog<Quote>(room, "quotes");
  const roster = useRoster(room);
  const rng = useFairRng(room, "meme-salts", {
    peerIds: roster.present,
    minContributors: 1,
  });
  const roundMap = room.doc.getMap<number>("meme-round");
  const winsMap = room.doc.getMap<number>("meme-wins");
  const roundN = roundMap.get("n") ?? 0;
  const votes = useVotes<string>(room, `vote-${roundN}`);
  const phase = usePhase<"voting" | "reveal">(room, "meme-phase", "voting");
  const [draft, setDraft] = useState("");

  const trimmed = name.trim();
  const list = quotes.events;
  const byId = new Map(list.map((q) => [q.id, q] as const));
  const shuffled = rng.shuffle(list.map((q) => q.id));
  const haveTwo = shuffled.length >= 2;
  const a = haveTwo ? shuffled[(2 * roundN) % shuffled.length] : null;
  const b = haveTwo ? shuffled[(2 * roundN + 1) % shuffled.length] : null;
  const qa = a ? (byId.get(a) ?? null) : null;
  const qb = b && b !== a ? (byId.get(b) ?? null) : null;
  const winnerId = phase.phase === "reveal" ? votes.winner : null;

  const submit = () => {
    const t = draft.trim();
    if (!t || !trimmed) return;
    quotes.push({
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      text: t.slice(0, 140),
      ts: Date.now(),
    });
    setDraft("");
  };

  const reveal = () => {
    if (!winnerId && qa && qb) {
      const w = votes.winner;
      if (w) {
        const q = byId.get(w);
        if (q) winsMap.set(q.peerId, (winsMap.get(q.peerId) ?? 0) + 1);
      }
    }
    phase.transition("reveal", { from: "voting" });
  };

  const next = () => {
    roundMap.set("n", roundN + 1);
    rng.rerollRound();
    phase.transition("voting", { from: "reveal" });
  };

  const board = Array.from(winsMap.entries())
    .map(([pid, score]) => ({
      id: pid,
      name: nameOf(pid) ?? "peer",
      score,
      isMe: pid === room.peerId,
    }))
    .sort((x, y) => y.score - x.score);

  const renderCard = (q: Quote | null, label: "A" | "B") => {
    if (!q) return null;
    const mine = q.peerId === room.peerId;
    const voted = votes.myVote === q.id;
    const isWinner = winnerId === q.id;
    return (
      <div className="meme-card" data-quote-id={q.id}>
        {isWinner && <div className="meme-trophy">🏆 winner</div>}
        <p className="meme-text">{q.text}</p>
        <p className="meme-author">— {nameOf(q.peerId)}</p>
        {phase.phase === "reveal" && (
          <div className="meme-bar" style={{ opacity: 0.4 + votes.pctOf(q.id) / 200 }}>
            {votes.tally.get(q.id) ?? 0} · {votes.pctOf(q.id)}%
          </div>
        )}
        {phase.phase === "voting" && (
          <button
            type="button"
            className="meme-vote"
            onClick={() => votes.vote(q.id)}
            disabled={mine || !trimmed}
          >
            {voted ? `voted ${label}` : `vote ${label}`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="meme-screen">
      <MeshToasts room={room} resolveName={nameOf} position="top" />
      <header className="meme-header">
        <h1>{config.appName}</h1>
        <p className="meme-status">
          round {roundN + 1} · {list.length} quotes · {room.peerCount + 1} peers
        </p>
      </header>
      <MeshNameInput
        className="meme-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />
      <div className="meme-submitbar">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="your quote"
          maxLength={140}
          disabled={!trimmed}
        />
        <button
          type="button"
          className="meme-submit"
          onClick={submit}
          disabled={!trimmed || !draft.trim()}
        >
          submit quote
        </button>
      </div>
      {!haveTwo ? (
        <p className="meme-hint">submit at least 2 quotes</p>
      ) : (
        <>
          <div className="meme-arena">
            {renderCard(qa, "A")}
            {renderCard(qb, "B")}
          </div>
          <div className="meme-controls">
            {phase.phase === "voting" ? (
              <button
                type="button"
                className="meme-reveal"
                onClick={reveal}
                disabled={votes.totalVotes === 0}
              >
                reveal
              </button>
            ) : (
              <button type="button" className="meme-next" onClick={next}>
                next round
              </button>
            )}
          </div>
        </>
      )}
      <Leaderboard items={board} highlightId={room.peerId} title="wins" emptyText="no wins yet" />
    </div>
  );
}
