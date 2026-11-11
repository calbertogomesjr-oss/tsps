import assert from "node:assert/strict";
import test from "node:test";

import { addChatLine, clearChatLines, getChatLines, plain } from "../game/plugins/gamechat/chatStore";

const GAME = 0;
const PUBLIC = 2;
const PRIVATE = 3;

test.beforeEach(() => clearChatLines());

test("a line carries its clock, so no render has to format one", () => {
    addChatLine(GAME, "", "You manage to mine some copper.");
    const [line] = getChatLines();
    // The whole point of the field: the log redraws far more often than it grows, and building an
    // Intl formatter per line per redraw was costing tens of milliseconds a frame.
    assert.match(line.clock, /^\d{2}:\d{2}$/);
    assert.equal(line.clock, new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(line.at));
});

test("each line is a new array, so the panel re-renders, but the old lines keep their identity", () => {
    addChatLine(GAME, "", "first");
    const before = getChatLines();
    addChatLine(GAME, "", "second");
    const after = getChatLines();
    assert.notEqual(before, after, "a new array, or useSyncExternalStore never re-renders");
    // Memoised lines only pay off if the objects themselves are reused.
    assert.equal(before[0], after[0], "the first line is the same object");
});

test("channels come from the message type", () => {
    addChatLine(GAME, "", "You advanced your Mining level.");
    addChatLine(PUBLIC, "kaytto", "hi");
    addChatLine(PRIVATE, "kaytto", "psst");
    assert.deepEqual(getChatLines().map((line) => line.channel), ["game", "public", "private"]);
    assert.equal(getChatLines()[0].milestone, true);
});

test("tags are stripped and empty lines are dropped", () => {
    assert.equal(plain("<col=ff0000>red</col>"), "red");
    addChatLine(GAME, "", "<col=ff0000></col>   ");
    assert.equal(getChatLines().length, 0);
});
