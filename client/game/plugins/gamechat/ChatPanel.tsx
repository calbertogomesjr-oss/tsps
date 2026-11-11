import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GameState } from "../../login/GameState";
import type { OsrsClient } from "../../OsrsClient";
import { useSubscribedGameState } from "../../useSubscribedGameState";
import { sendChat } from "../../../network/ServerConnection";
import { getChatLines, subscribeChat, type ChatChannel, type ChatLine } from "./chatStore";
import "./ChatPanel.css";

type Filter = "all" | ChatChannel;

const TABS: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "Tudo" },
    { key: "game", label: "Jogo" },
    { key: "public", label: "Público" },
    { key: "private", label: "Privado" },
];

/**
 * The chatbox, as a panel rather than the parchment the canvas draws.
 *
 * Three things it fixes. The parchment is the brightest thing on screen and sits in the corner
 * you look at least, so it pulls the eye off the world. Nothing is timestamped, which matters in
 * a game you come back to after hours. And the channels are a row of tiny buttons with no sense
 * of what is unread.
 *
 * The canvas box stays underneath, still fed by the game; this covers it.
 */
export const ChatPanel = memo(function ChatPanel({ osrsClient }: { osrsClient: OsrsClient }) {
    const gameState = useSubscribedGameState(osrsClient.stateMachine);
    const lines = useSyncExternalStore(subscribeChat, getChatLines, getChatLines);
    const [filter, setFilter] = useState<Filter>("all");
    const [draft, setDraft] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const [seen, setSeen] = useState<Record<ChatChannel, number>>({ game: 0, public: 0, private: 0 });
    const logRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const shown = useMemo(
        () => (filter === "all" ? lines : lines.filter((line) => line.channel === filter)),
        [lines, filter],
    );

    const counts = useMemo(() => {
        const totals: Record<ChatChannel, number> = { game: 0, public: 0, private: 0 };
        for (const line of lines) totals[line.channel] += 1;
        return totals;
    }, [lines]);

    // Stick to the newest line, which is what a log is for - but writing scrollTop forces layout,
    // so only when there is something new, and never while the reader has scrolled up to read.
    const scrolled = useRef(-1);
    useEffect(() => {
        const log = logRef.current;
        if (!log) return;
        // A log that has just been unfolded is a fresh element at the top: it always goes down.
        const reopened = scrolled.current < 0;
        const grew = shown.length !== scrolled.current;
        scrolled.current = shown.length;
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
        if (reopened || (grew && atBottom)) log.scrollTop = log.scrollHeight;
    }, [shown, collapsed]);

    // Folding throws the log element away; the next one starts at the top and must be sent down.
    useEffect(() => {
        if (collapsed) scrolled.current = -1;
    }, [collapsed]);

    // Looking at a channel marks it read; "Tudo" marks everything. The equality check matters:
    // a fresh object every message means a second render every message, for nothing.
    useEffect(() => {
        setSeen((previous) => {
            const next = filter === "all" ? counts : { ...previous, [filter]: counts[filter] };
            const same = next.game === previous.game
                && next.public === previous.public
                && next.private === previous.private;
            return same ? previous : next;
        });
    }, [filter, counts]);

    // Only once the player is actually in the world: a chatbox over the loading bar or the login
    // page is furniture for a room nobody is in yet.
    if (gameState !== GameState.LOGGED_IN) return null;

    function submit(event: React.FormEvent) {
        event.preventDefault();
        const text = draft.trim();
        if (!text) return;
        sendChat(text, "public", 0);
        setDraft("");
    }

    return (
        <div className={`gc${collapsed ? " is-collapsed" : ""}`}>
            <div className="gc__tabs">
                {TABS.map((tab) => {
                    const unread = tab.key === "all" ? 0 : counts[tab.key] - (seen[tab.key] ?? 0);
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            className={`gc__tab${tab.key === filter ? " is-on" : ""}`}
                            onClick={() => setFilter(tab.key)}
                        >
                            {tab.label}
                            {unread > 0 && <span className="gc__unread">{unread > 99 ? "99+" : unread}</span>}
                        </button>
                    );
                })}
                <button
                    type="button"
                    className="gc__fold"
                    onClick={() => setCollapsed((value) => !value)}
                    title={collapsed ? "Abrir o chat" : "Recolher o chat"}
                    aria-label={collapsed ? "Abrir o chat" : "Recolher o chat"}
                >
                    {collapsed ? "▴" : "▾"}
                </button>
            </div>

            {!collapsed && (
                <>
                    <div className="gc__log" ref={logRef}>
                        {shown.length === 0 && <p className="gc__empty">Nada por aqui ainda.</p>}
                        {shown.map((line) => (
                            <Line key={line.id} line={line} />
                        ))}
                    </div>

                    <form className="gc__input" onSubmit={submit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={draft}
                            maxLength={80}
                            placeholder="Digite para falar"
                            onChange={(event) => setDraft(event.target.value)}
                            // The game listens for keys on the whole window: without this, typing
                            // here would also walk the character and flip through its tabs.
                            onKeyDown={(event) => event.stopPropagation()}
                            onKeyUp={(event) => event.stopPropagation()}
                            onKeyPress={(event) => event.stopPropagation()}
                        />
                    </form>
                </>
            )}
        </div>
    );
});

/**
 * One line, memoised.
 *
 * The HUD is rebuilt whenever the game container re-renders, and the container re-renders several
 * times a second. Without this every line in the log - up to 250 of them - was rebuilt each time,
 * on the same thread that draws the game.
 */
const Line = memo(function Line({ line }: { line: ChatLine }) {
    const kind = line.milestone ? "is-milestone" : `is-${line.channel}`;
    return (
        <p className={`gc__line ${kind}`}>
            <span className="gc__time">{line.clock}</span>
            {line.name && line.channel !== "game" && <b className="gc__who">{line.name}:</b>}
            <span className="gc__text">{line.text}</span>
        </p>
    );
});
