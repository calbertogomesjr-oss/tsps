// A new player has no registration screen to fill in: "New User" opens the same login form,
// and the server creates the account on its first login (NetworkBuilder: a typed name with no
// stored credentials, refused only when DisplayNames.ownerOf already holds it).
import assert from "node:assert/strict";

import { LoginIndex } from "../game/login/GameState";
import { LoginState } from "../game/login/LoginState";

const store = new Map<string, string>();
const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
};
(globalThis as any).window = { localStorage, location: { hostname: "localhost" } };
(globalThis as any).localStorage = localStorage;

const state = new LoginState();

// "New User" opens the login form with an empty name and asks for one.
state.username = "Zezima";
state.password = "hunter2";
state.promptNewAccount();
assert.equal(state.loginIndex, LoginIndex.LOGIN_FORM);
assert.equal(state.creatingAccount, true);
assert.equal(state.username, "");
assert.equal(state.password, "");
assert.equal(state.currentLoginField, 0, "the name is typed first");
assert.equal(state.response1, "Choose your username & password.");
assert.ok(state.response2.length > 0, "and says the account is made as it logs in");

// It is the same form and the same login packet: nothing new to validate.
assert.equal(state.canAttemptLogin(), false);
state.username = "New Player";
state.password = "hunter2!";
assert.equal(state.canAttemptLogin(), true, "a free name and a password are all the server needs");

// A name the server would never accept is still refused before the packet goes out.
state.username = "bad*name";
assert.equal(state.canAttemptLogin(), false);

// "Existing User" is the sign-in form again, and a reset leaves the mode behind.
state.promptCredentials();
assert.equal(state.creatingAccount, false);
assert.equal(state.response1, "Enter your username & password.");
state.promptNewAccount();
state.reset();
assert.equal(state.creatingAccount, false);
assert.equal(state.loginIndex, LoginIndex.WELCOME);

console.log("new-account-login: ok");
