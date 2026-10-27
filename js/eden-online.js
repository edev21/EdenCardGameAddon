/*
Online games in chat rooms: two players with the addon, watched by the room's other addon users.

Lockstep sync: only moves are sent (see EdenApplyMove). Every client builds the game from the same setup
(decks + shared seed, see EdenCreateGameState) and applies the same moves in order, so all compute the same game.
Each move carries a state checksum to catch desyncs. Late joiners, reconnects and desynced clients get the
full record (a "game" message) and replay it.

Messages are hidden chat messages (Content "EdenCardGame"), invisible to players without the addon.
The room's Game setting is never changed.

Message types (the object in the message's Dictionary):
- hello:  on entering a room. Others answer with their seat, and the running game if they hold it.
- seat:   { seat: 0 | 1 | null } the sender's seat.
- start:  { game } an admin started a game: { id, room, seed, fingerprint, players, names, decks, moves, chat }.
          decks starts [null, null], so both players get the deck selection screen.
- deck:   { id, seat, deck } a player picked a deck. Once both are in, every client begins the game.
- move:   { id, n, move, sum } the nth move, from the player whose turn it is; sum is the checksum.
- sync:   { id } asks the receiver for the full game (after a desync or missed move).
- game:   { id, part, parts, text } the full record as JSON, split into chunks.
- cancel: { id } an admin stopped the game.
- reset:  an admin cleared both seats and the game.
- chat:   { id, n, text } game chat sent after n moves; kept in game.chat so late joiners see it.

Settings (Auto Spectate) are kept in localStorage.
*/

const EdenOnlineContent = "EdenCardGame";
// Bump when the rules engine changes in a way that makes versions disagree.
const EdenOnlineProtocol = 3;
const EdenOnlineChunkSize = 4000;
const EdenOnlineSettingsKey = "edenCardGameSettings";

// The running (or last finished) online game record, or null.
let EdenOnlineGame = null;
// Seats chosen by other addon users in the room: memberNumber -> { seat, name }.
let EdenOnlineSeats = {};
// This player's seat (0, 1 or null).
let EdenOnlineMySeat = null;
let EdenOnlineRoomName = null;
// "game" message chunks still arriving: `${sender}:${id}` -> string[].
let EdenOnlineGameParts = {};
let EdenOnlineLastHello = 0;
let EdenOnlineLobbyElement = null;
// Turn of the last "It's your turn" notice, so it shows once per turn.
let EdenOnlineNotifiedTurn = null;

function EdenOnlineGetSettings() {
    try {
        return JSON.parse(localStorage.getItem(EdenOnlineSettingsKey) ?? "{}") ?? {};
    } catch {
        return {};
    }
}

function EdenOnlineSaveSetting(key, value) {
    const settings = EdenOnlineGetSettings();
    settings[key] = value;
    try {
        localStorage.setItem(EdenOnlineSettingsKey, JSON.stringify(settings));
    } catch (error) {
        console.error("Eden Card Game: could not save settings.", error);
    }
}

function EdenOnlineIsAutoSpectate() {
    return EdenOnlineGetSettings().autoSpectate ?? true;
}

// Hash of the protocol and all card/class definitions (effect code included). Clients must match to play together.
function EdenOnlineGetFingerprint() {
    const text = EdenOnlineProtocol + JSON.stringify([EdenCardDatabase, EdenCardClasses], (key, value) => typeof value === "function" ? String(value) : value);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
}

function EdenOnlineIsInRoom(memberNumber) {
    return typeof ChatRoomCharacter !== "undefined" && ChatRoomCharacter.some(c => c.MemberNumber === memberNumber);
}

function EdenOnlineNotice(text) {
    if (typeof ChatRoomSendLocal === "function") ChatRoomSendLocal(`Eden Card Game: ${text}`);
}

// Sends a hidden chat message to the room, or only to target (a member number).
function EdenOnlineSend(data, target = null) {
    const message = { Content: EdenOnlineContent, Type: "Hidden", Dictionary: [{ EdenCardGame: data }] };
    if (target !== null) message.Target = target;
    ServerSend("ChatRoomChat", message);
}

// Sends the full game record in chunks (too big for one message).
function EdenOnlineSendGame(target = null) {
    if (!EdenOnlineGame) return;
    const text = JSON.stringify(EdenOnlineGame);
    const parts = Math.ceil(text.length / EdenOnlineChunkSize);
    for (let part = 0; part < parts; part++) {
        EdenOnlineSend({ type: "game", id: EdenOnlineGame.id, part, parts, text: text.slice(part * EdenOnlineChunkSize, (part + 1) * EdenOnlineChunkSize) }, target);
    }
}

// Called by EdenSubmitMove after a local move was applied: records and broadcasts it.
function EdenOnlineSendMove(move) {
    const game = EdenGameState.online;
    game.moves.push(move);
    EdenOnlineSend({ type: "move", id: game.id, n: game.moves.length - 1, move, sum: EdenGetStateChecksum() });
}

// Called by EdenSendGameChat after logging local chat: records and broadcasts it.
function EdenOnlineSendChat(text) {
    const game = EdenGameState.online;
    const n = game.moves.length;
    (game.chat ??= []).push({ n, member: Player.MemberNumber, name: CharacterNickname(Player), text });
    EdenOnlineSend({ type: "chat", id: game.id, n, text });
}

function EdenOnlineHandleChat(message, sender) {
    const game = EdenOnlineGame;
    if (!game || message.id !== game.id || typeof message.text !== "string") return;
    const text = message.text.slice(0, EdenGameChatMaxLength);
    const name = CharacterNickname(sender);
    (game.chat ??= []).push({ n: Number.isInteger(message.n) ? message.n : game.moves.length, member: sender.MemberNumber, name, text });
    // Game not built here (e.g. Auto Spectate off): only the record keeps it.
    if (!EdenOnlineIsShowingGame()) return;
    EdenAddGameChat(name, text);
    if (EdenIsGameOpen()) EdenShowGameBoard();
}

// Builds EdenGameState from EdenOnlineGame: create from the setup, then replay every move. open shows the window.
function EdenOnlineLoadGame(open) {
    const game = EdenOnlineGame;
    const seat = game.players.indexOf(Player.MemberNumber);
    const localSeat = seat === -1 ? null : seat;

    EdenCreateGameState({
        seed: game.seed,
        decks: game.decks,
        names: game.names,
        memberNumbers: game.players,
        controls: [0, 1].map(s => s === localSeat ? "local" : "remote"),
        localSeat
    });
    EdenGameState.online = game;
    EdenBeginGame();
    // Chat is reinserted between the moves it was sent after.
    const chat = game.chat ?? [];
    let chatIndex = 0;
    const addChatUpTo = n => {
        for (; chatIndex < chat.length && chat[chatIndex].n <= n; chatIndex++) {
            EdenAddGameChat(chat[chatIndex].member === Player.MemberNumber ? "You" : chat[chatIndex].name, chat[chatIndex].text);
        }
    };
    for (const [n, move] of game.moves.entries()) {
        addChatUpTo(n);
        if (!EdenApplyMove(move)) {
            console.warn("Eden Card Game: a recorded move could not be replayed.", move);
            break;
        }
    }
    addChatUpTo(Infinity);

    EdenSelectedHandIndex = null;
    EdenAbilitySelecting = false;
    EdenRestingRoomOpen = false;
    EdenOnlineCloseLobby();
    if (open) EdenOpenCardGame();
    else if (EdenIsGameOpen()) EdenShowGameBoard();
}

// Whether EdenGameState is the online game (rather than a local game or nothing).
function EdenOnlineIsShowingGame() {
    return !!EdenOnlineGame && EdenGameState?.online === EdenOnlineGame;
}

// Whether a game opens by itself: always for its players; for spectators with Auto Spectate on, unless mid-game vs the NPC.
function EdenOnlineShouldOpen(game) {
    if (game.players.includes(Player.MemberNumber)) return true;
    const inLocalGame = EdenGameState && !EdenGameState.online && !EdenGameState.gameOver;
    return EdenOnlineIsAutoSpectate() && !inLocalGame;
}

// Forgets the online game (finished and closed, or cancelled).
function EdenOnlineClearGame() {
    EdenOnlineGame = null;
    if (EdenGameState?.online) EdenGameState = null;
}

// Takes in a game record from a "start" or "game" message, if valid, same version and not out of date.
function EdenOnlineAcceptGame(game, sender) {
    const valid = game && typeof game.seed === "number" && Array.isArray(game.players) && game.players.length === 2
        && Array.isArray(game.decks) && game.decks.length === 2 && game.decks.every(d => d === null || Array.isArray(d?.cards)) && Array.isArray(game.moves);
    if (!valid) return false;

    if (game.fingerprint !== EdenOnlineGetFingerprint()) {
        EdenOnlineNotice(`${CharacterNickname(sender)} uses a different version of the addon, so you can't join or watch this game.`);
        return false;
    }

    // Out of date: an older game, or ours with fewer moves.
    if (EdenOnlineGame && (game.id < EdenOnlineGame.id || (game.id === EdenOnlineGame.id && game.moves.length < EdenOnlineGame.moves.length && EdenOnlineIsShowingGame()))) return false;

    // Same game during deck picking: keep the decks we already know.
    if (EdenOnlineGame && game.id === EdenOnlineGame.id) game.decks = game.decks.map((deck, seat) => deck ?? EdenOnlineGame.decks[seat]);

    const wasShowing = EdenOnlineIsShowingGame();
    EdenOnlineGame = game;
    if (!EdenOnlineHasBothDecks(game)) {
        if (wasShowing) EdenGameState = null;
        if (game.players.includes(Player.MemberNumber)) EdenOnlineShowDeckSelect();
        else if (wasShowing && EdenIsGameOpen()) EdenCloseCardGame();
        return true;
    }
    if (wasShowing || EdenOnlineShouldOpen(game)) EdenOnlineLoadGame(!wasShowing || EdenIsGameOpen());
    return true;
}

/*
Deck selection (after an admin starts a game)
*/

function EdenOnlineHasBothDecks(game) {
    return game.decks.every(deck => deck);
}

// Whether this player is in the game being set up and hasn't picked a deck yet.
function EdenOnlineIsPickingDeck() {
    const game = EdenOnlineGame;
    if (!game || EdenOnlineHasBothDecks(game)) return false;
    const seat = game.players.indexOf(Player.MemberNumber);
    return seat !== -1 && !game.decks[seat];
}

// Shown instead of the deck list once this player has picked, or null.
function EdenOnlineGetDeckWaitingText() {
    const game = EdenOnlineGame;
    if (!game || EdenGameState || EdenOnlineHasBothDecks(game) || !game.players.includes(Player.MemberNumber) || EdenOnlineIsPickingDeck()) return null;
    return `Waiting for ${game.names[game.decks.indexOf(null)]} to choose a deck...`;
}

// Opens the game window on deck selection (dropping any other game shown in it).
function EdenOnlineShowDeckSelect() {
    if (EdenGameState) EdenGameState = null;
    EdenOnlineCloseLobby();
    EdenOpenCardGame();
}

function EdenOnlinePickDeck(deck) {
    const game = EdenOnlineGame;
    const seat = game.players.indexOf(Player.MemberNumber);
    const record = { name: deck.name, class: deck.class, cards: deck.cards };
    game.decks[seat] = record;
    EdenOnlineSend({ type: "deck", id: game.id, seat, deck: record });
    EdenOnlineOnDeckPicked();
}

function EdenOnlineHandleDeck(message, sender) {
    const game = EdenOnlineGame;
    if (!game || message.id !== game.id || game.players[message.seat] !== sender.MemberNumber || game.decks[message.seat] || !Array.isArray(message.deck?.cards)) return;
    game.decks[message.seat] = message.deck;
    EdenOnlineOnDeckPicked();
}

// Begins the game once both decks are in; until then, refreshes the waiting screen.
function EdenOnlineOnDeckPicked() {
    const game = EdenOnlineGame;
    if (EdenOnlineHasBothDecks(game)) {
        if (EdenOnlineShouldOpen(game)) EdenOnlineLoadGame(true);
    } else if (EdenIsGameOpen() && !EdenGameState) EdenShowGameDeckSelect();
}

/*
Who answers a "hello" with the game: its first player in the room (other than the asker).
If neither is there, every spectator holding it answers; the asker keeps the newest copy.
*/
function EdenOnlineShouldAnswerHello(requester) {
    const present = EdenOnlineGame.players.filter(m => m !== requester && EdenOnlineIsInRoom(m));
    return present.length === 0 || present[0] === Player.MemberNumber;
}

function EdenOnlineHandleMove(message, sender) {
    const game = EdenOnlineGame;
    if (!game || message.id !== game.id) return;
    // Lower n: a repeat. Higher n: a move was missed, so ask for the full game.
    if (message.n < game.moves.length) return;
    if (message.n > game.moves.length) {
        EdenOnlineSend({ type: "sync", id: game.id }, sender.MemberNumber);
        return;
    }

    if (!EdenOnlineIsShowingGame()) {
        // Game not built here (e.g. Auto Spectate off): just keep the record up to date.
        game.moves.push(message.move);
        return;
    }

    // Only the player whose turn it is may move.
    if (EdenGameState[EdenGameState.currentTurn].memberNumber !== sender.MemberNumber) return;

    if (!EdenApplyMove(message.move)) {
        EdenOnlineSend({ type: "sync", id: game.id }, sender.MemberNumber);
        return;
    }
    game.moves.push(message.move);

    if (message.sum !== EdenGetStateChecksum()) {
        console.warn("Eden Card Game: desync detected, asking for the full game.");
        EdenOnlineSend({ type: "sync", id: game.id }, sender.MemberNumber);
    }

    if (EdenIsGameOpen()) EdenShowGameBoard();
    else if (EdenIsLocalTurn() && EdenOnlineNotifiedTurn !== EdenGameState.turn) {
        EdenOnlineNotifiedTurn = EdenGameState.turn;
        EdenOnlineNotice("It's your turn.");
    }
}

function EdenOnlineHandleGamePart(message, sender) {
    if (typeof message.text !== "string" || !Number.isInteger(message.part) || !Number.isInteger(message.parts)) return;
    const key = `${sender.MemberNumber}:${message.id}`;
    const parts = EdenOnlineGameParts[key] ??= [];
    parts[message.part] = message.text;
    if (parts.filter(p => p !== undefined).length < message.parts) return;

    delete EdenOnlineGameParts[key];
    try {
        EdenOnlineAcceptGame(JSON.parse(parts.join("")), sender);
    } catch (error) {
        console.error("Eden Card Game: could not read a game.", error);
    }
}

// Dispatches an Eden message from another room member.
function EdenOnlineReceive(data, sender) {
    const message = Array.isArray(data.Dictionary) ? data.Dictionary[0]?.EdenCardGame : null;
    // The server echoes our own messages back; ignore them.
    if (!message || typeof message.type !== "string" || sender.IsPlayer()) return;

    switch (message.type) {
        case "hello":
            if (EdenOnlineMySeat !== null) EdenOnlineSend(EdenOnlineGetMySeatMessage(), sender.MemberNumber);
            if (EdenOnlineGame && EdenOnlineShouldAnswerHello(sender.MemberNumber)) EdenOnlineSendGame(sender.MemberNumber);
            break;

        case "seat":
            if (message.seat === 0 || message.seat === 1) EdenOnlineSeats[sender.MemberNumber] = { seat: message.seat, name: CharacterNickname(sender) };
            else delete EdenOnlineSeats[sender.MemberNumber];
            // Someone took our seat: the last to pick it keeps it.
            if (message.seat !== null && message.seat === EdenOnlineMySeat) EdenOnlineMySeat = null;
            break;

        case "start":
            if (!ChatRoomCharacterIsAdmin(sender)) return;
            EdenOnlineAcceptGame(message.game, sender);
            break;

        case "deck":
            EdenOnlineHandleDeck(message, sender);
            break;

        case "move":
            EdenOnlineHandleMove(message, sender);
            break;

        case "chat":
            EdenOnlineHandleChat(message, sender);
            break;

        case "sync":
            if (EdenOnlineGame && message.id === EdenOnlineGame.id) EdenOnlineSendGame(sender.MemberNumber);
            break;

        case "game":
            EdenOnlineHandleGamePart(message, sender);
            break;

        case "cancel":
            if (!ChatRoomCharacterIsAdmin(sender) || !EdenOnlineGame || message.id !== EdenOnlineGame.id) return;
            EdenOnlineEndCancelledGame(`${CharacterNickname(sender)} stopped the game.`);
            break;

        case "reset":
            if (!ChatRoomCharacterIsAdmin(sender)) return;
            EdenOnlineApplyReset(`${CharacterNickname(sender)} reset the game.`);
            break;
    }
    EdenOnlineRefreshLobby();
}

function EdenOnlineEndCancelledGame(notice) {
    const wasShowing = EdenOnlineIsShowingGame();
    EdenOnlineClearGame();
    if (wasShowing && EdenIsGameOpen()) EdenCloseCardGame();
    EdenOnlineNotice(notice);
}

/*
Seats
*/

function EdenOnlineGetMySeatMessage() {
    return { type: "seat", seat: EdenOnlineMySeat };
}

// The person in a seat (if they're in the room): { memberNumber, name }, or null.
function EdenOnlineGetSeatHolder(seat) {
    if (EdenOnlineMySeat === seat) return { memberNumber: Player.MemberNumber, name: CharacterNickname(Player) };
    for (const [memberNumber, entry] of Object.entries(EdenOnlineSeats)) {
        if (entry.seat === seat && EdenOnlineIsInRoom(Number(memberNumber))) return { memberNumber: Number(memberNumber), name: entry.name };
    }
    return null;
}

function EdenOnlineTakeSeat(seat) {
    EdenOnlineMySeat = seat;
    EdenOnlineSend(EdenOnlineGetMySeatMessage());
    EdenOnlineRefreshLobby();
}

/*
Starting and stopping (room admins only)
*/

function EdenOnlineCanStart() {
    if (!ChatRoomPlayerIsAdmin()) return false;
    const holders = [0, 1].map(EdenOnlineGetSeatHolder);
    return holders.every(h => h);
}

function EdenOnlineStartGame() {
    const [first, second] = [0, 1].map(EdenOnlineGetSeatHolder);
    if (!EdenOnlineCanStart() || !first || !second) return;
    const holders = [first, second];
    const game = {
        // Later games have higher ids, so a stale copy of an old game is never taken over a new one.
        // Above the last game's id even if this admin's clock is behind the previous admin's.
        id: Math.max(Date.now(), (EdenOnlineGame?.id ?? 0) + 1),
        room: ChatRoomData.Name,
        seed: EdenNewSeed(),
        fingerprint: EdenOnlineGetFingerprint(),
        players: holders.map(h => h.memberNumber),
        names: holders.map(h => h.name),
        // Filled in by the players on the deck selection screen (see EdenOnlinePickDeck).
        decks: [null, null],
        moves: [],
        chat: []
    };

    EdenOnlineSend({ type: "start", game });
    EdenOnlineAcceptGame(game, Player);
}

function EdenOnlineCancelGame() {
    if (!EdenOnlineGame || !ChatRoomPlayerIsAdmin()) return;
    EdenOnlineSend({ type: "cancel", id: EdenOnlineGame.id });
    EdenOnlineEndCancelledGame("You stopped the game.");
    EdenOnlineRefreshLobby();
}

function EdenOnlineResetGame() {
    if (!ChatRoomPlayerIsAdmin()) return;
    EdenOnlineSend({ type: "reset" });
    EdenOnlineApplyReset("You reset the game.");
    EdenOnlineRefreshLobby();
}

// Empties both seats and forgets the game, if there is one.
function EdenOnlineApplyReset(notice) {
    EdenOnlineSeats = {};
    EdenOnlineMySeat = null;
    EdenOnlineGameParts = {};
    if (EdenOnlineGame) EdenOnlineEndCancelledGame(notice);
    else EdenOnlineNotice(notice);
}

// Opens the running game's window, building its state first if this computer isn't showing it yet.
function EdenOnlineWatchGame() {
    if (!EdenOnlineGame) return;
    if (EdenOnlineIsShowingGame()) {
        EdenOnlineCloseLobby();
        EdenOpenCardGame();
    } else EdenOnlineLoadGame(true);
}

/*
Lobby window (opened from the chat room menu's Eden button)
*/

function EdenOnlineOpenLobby() {
    if (!EdenOnlineLobbyElement) {
        EdenOnlineLobbyElement = EdenCreateElement("div", "eden-online-lobby-overlay");
        EdenOnlineLobbyElement.id = "eden-online-lobby";
        document.body.appendChild(EdenOnlineLobbyElement);
    }
    EdenOnlineRefreshLobby(true);
}

function EdenOnlineCloseLobby() {
    EdenOnlineLobbyElement?.remove();
    EdenOnlineLobbyElement = null;
}

function EdenOnlineRefreshLobby(force = false) {
    const lobby = EdenOnlineLobbyElement;
    if (!lobby || (!force && !document.body.contains(lobby))) return;
    lobby.innerHTML = "";

    const panel = EdenCreateElement("div", "eden-online-lobby");
    panel.appendChild(EdenCreateElement("h2", "eden-online-lobby-title", "Eden Card Game"));

    const game = EdenOnlineGame;
    const running = game && !(EdenOnlineIsShowingGame() && EdenGameState.gameOver);

    if (running && !EdenOnlineHasBothDecks(game)) {
        panel.appendChild(EdenCreateElement("div", "eden-online-lobby-status", `Choosing decks: ${game.names[0]} vs ${game.names[1]}`));
        if (game.players.includes(Player.MemberNumber)) panel.appendChild(EdenOnlineLobbyButton(EdenOnlineIsPickingDeck() ? "Choose Deck" : "Return to Game", EdenOnlineShowDeckSelect));
    } else if (running) {
        const status = EdenCreateElement("div", "eden-online-lobby-status", `Game in progress: ${game.names[0]} vs ${game.names[1]}`);
        panel.appendChild(status);
        const isPlayer = game.players.includes(Player.MemberNumber);
        panel.appendChild(EdenOnlineLobbyButton(isPlayer ? "Return to Game" : "Watch Game", EdenOnlineWatchGame));
    }

    // Seats
    for (const seat of [0, 1]) {
        const holder = EdenOnlineGetSeatHolder(seat);
        const row = EdenCreateElement("div", "eden-online-lobby-seat");
        row.appendChild(EdenCreateElement("div", "eden-online-lobby-seat-label", `Player ${seat + 1}`));
        row.appendChild(EdenCreateElement("div", "eden-online-lobby-seat-name", holder ? holder.name : "Empty"));

        if (EdenOnlineMySeat === seat) row.appendChild(EdenOnlineLobbyButton("Leave Seat", () => EdenOnlineTakeSeat(null)));
        else if (!holder) row.appendChild(EdenOnlineLobbyButton("Take Seat", () => EdenOnlineTakeSeat(seat), EdenGetDecks().length === 0));
        panel.appendChild(row);
    }
    if (EdenGetDecks().length === 0) panel.appendChild(EdenCreateElement("div", "eden-online-lobby-note", "Build a deck first (Eden Card Club, in the main hall)."));

    // Auto Spectate
    const spectateRow = EdenCreateElement("label", "eden-online-lobby-row");
    const checkbox = EdenCreateElement("input", "");
    checkbox.type = "checkbox";
    checkbox.checked = EdenOnlineIsAutoSpectate();
    checkbox.addEventListener("change", () => EdenOnlineSaveSetting("autoSpectate", checkbox.checked));
    spectateRow.appendChild(checkbox);
    spectateRow.appendChild(EdenCreateElement("span", "", "Auto Spectate (watch games in this room automatically)"));
    panel.appendChild(spectateRow);

    // Admin controls
    const buttons = EdenCreateElement("div", "eden-online-lobby-buttons");
    if (ChatRoomPlayerIsAdmin()) {
        buttons.appendChild(EdenOnlineLobbyButton("Start Game", EdenOnlineStartGame, !EdenOnlineCanStart()));
        if (running) buttons.appendChild(EdenOnlineLobbyButton("Stop Game", EdenOnlineCancelGame, false, true));
        buttons.appendChild(EdenOnlineLobbyButton("Reset", EdenOnlineResetGame, false, true));
    } else buttons.appendChild(EdenCreateElement("div", "eden-online-lobby-note", "A room admin with the addon starts the game once both seats are taken."));
    buttons.appendChild(EdenOnlineLobbyButton("Close", EdenOnlineCloseLobby));
    panel.appendChild(buttons);

    lobby.appendChild(panel);
}

function EdenOnlineLobbyButton(label, onClick, disabled = false, danger = false) {
    const button = EdenCreateElement("button", `eden-deck-builder-button eden-deck-builder-small-button${danger ? " eden-deck-builder-danger-button" : ""}`, label);
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
}

/*
Room events
*/

// Entering or re-syncing a room (e.g. after a reconnect): say hello to get seats and the running game.
function EdenOnlineOnRoomSync() {
    const room = ChatRoomData?.Name ?? null;
    if (room !== EdenOnlineRoomName) {
        EdenOnlineRoomName = room;
        EdenOnlineSeats = {};
        EdenOnlineMySeat = null;
        // A game from another room can't continue here.
        if (EdenOnlineGame && EdenOnlineGame.room !== room) EdenOnlineLeaveGame();
    }

    // ChatRoomSync can run several times in a row; one hello is enough.
    if (Date.now() - EdenOnlineLastHello < 2000) return;
    EdenOnlineLastHello = Date.now();
    EdenOnlineSend({ type: "hello" });
}

// Leaving the room closes the window; the others keep the game, so returning continues it.
function EdenOnlineLeaveGame() {
    const wasShowing = EdenOnlineIsShowingGame();
    EdenOnlineGame = null;
    if (wasShowing) {
        EdenGameState = null;
        if (EdenIsGameOpen()) EdenCloseCardGame();
    }
}

function EdenOnlineOnRoomLeave() {
    EdenOnlineRoomName = null;
    EdenOnlineSeats = {};
    EdenOnlineMySeat = null;
    EdenOnlineLeaveGame();
    EdenOnlineCloseLobby();
}

/*
Hooks into the host game (chat room menu button, hidden messages, entering and leaving rooms).
*/
function EdenOnlineRegisterHooks() {
    ChatRoomRegisterMessageHandler({
        Description: "Eden Card Game online play",
        // Pre-handlers (negative priority) see hidden messages before the game drops them.
        Priority: -500,
        Callback: (data, sender) => {
            if (data.Type !== "Hidden" || data.Content !== EdenOnlineContent) return false;
            EdenOnlineReceive(data, sender);
            return true;
        }
    });

    EdenModApi.hookFunction("ChatRoomMenuBuild", 0, (args, next) => {
        next(args);
        ChatRoomMenuButtons.push(EdenOnlineContent);
    });

    EdenModApi.hookFunction("ChatRoomMenuButtonVisualState", 0, (args, next) => {
        if (args[0] !== EdenOnlineContent) return next(args);
        return { image: "Icons/Rectangle/GameOption.png", state: "Default", hoverText: "Eden Card Game" };
    });

    EdenModApi.hookFunction("ChatRoomMenuPerformAction", 0, (args, next) => {
        if (args[0] !== EdenOnlineContent) return next(args);
        EdenOnlineOpenLobby();
    });

    EdenModApi.hookFunction("ChatRoomSync", 0, async (args, next) => {
        await next(args);
        EdenOnlineOnRoomSync();
    });

    EdenModApi.hookFunction("ChatRoomLeave", 0, (args, next) => {
        const result = next(args);
        EdenOnlineOnRoomLeave();
        return result;
    });
}

if (EdenInHostGame) EdenOnlineRegisterHooks();
