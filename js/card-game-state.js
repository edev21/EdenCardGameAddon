// Game state and rules. The UI lives in card-game.js. Rules must stay deterministic (see EdenCreateRandom).

let EdenGameState = null;

/*
Card instances: every card in a game (deck, hand, board, backstage) is its own { uid, id, ...bonuses } object,
so effects can change one copy without touching the shared definition in cards.js.
*/
let EdenNextCardUid = 1;

/** @returns {EdenCardInstance} */
function EdenCreateCardInstance(cardId) {
    return EdenResetCardInstance({ uid: EdenNextCardUid++, id: cardId });
}

// Clears all effect changes on a copy. New copies start here too, so new per-copy stats go here (and in the checksum).
function EdenResetCardInstance(instance) {
    instance.entryFameBonus = 0;
    instance.exitFameBonus = 0;
    return instance;
}

// The card definition for a copy.
function EdenGetCard(instance) {
    return instance ? EdenGetCardById(instance.id) : undefined;
}

function EdenGetEntryFame(instance) {
    return (EdenGetCard(instance)?.entryFame ?? 0) + instance.entryFameBonus;
}

function EdenGetExitFame(instance) {
    return (EdenGetCard(instance)?.exitFame ?? 0) + instance.exitFameBonus;
}

/*
Seeded RNG (mulberry32). Same seed + same moves = same results on every client, which online sync relies on.
Rules must use EdenRandom(), never Math.random(); Math.random() is only for things outside the rules.
*/
function EdenCreateRandom(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// [0, 1) from the current game's seeded RNG.
function EdenRandom() {
    return EdenGameState.random();
}

function EdenNewSeed() {
    return Math.floor(Math.random() * 4294967296);
}

// Shuffled copy, using the seeded RNG.
function EdenShuffleArray(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(EdenRandom() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/*
Builds a game from a setup: { seed, decks: [d0, d1], names: [n0, n1], controls: [c0, c1], memberNumbers?: [m0, m1], localSeat }
control: "local" (this computer), "ai" or "remote" (online). localSeat: this computer's seat, or null for a spectator.
Seat 0 is built before seat 1, so every client builds the same game from the same setup.
"player" (bottom of the screen) is the local seat, or seat 0 for spectators; "opponent" is the other. Both point into seats.
*/
function EdenCreateGameState(setup) {
    // Restart uids so every client numbers the copies the same way.
    EdenNextCardUid = 1;

    // Created first so the shuffles below can use its RNG.
    EdenGameState = { random: EdenCreateRandom(setup.seed) };

    const seats = [0, 1].map(seat => ({
        seat,
        name: setup.names[seat],
        control: setup.controls[seat],
        memberNumber: setup.memberNumbers?.[seat] ?? null,
        fullDeck: setup.decks[seat],
        deck: EdenShuffleArray(setup.decks[seat].cards).map(EdenCreateCardInstance),
        hand: [],
        board: [null, null, null, null],
        restingRoom: [],
        fame: 0,
        turnNumber: 0,
        // Extra times the next Arrival runs (Secretary).
        arrivalRepeats: 0
    }));

    const bottomSeat = setup.localSeat ?? 0;
    const first = seats[EdenRandom() < 0.5 ? 0 : 1];

    Object.assign(EdenGameState, {
        seats,
        localSeat: setup.localSeat,
        player: seats[bottomSeat],
        opponent: seats[1 - bottomSeat],
        currentTurn: first === seats[bottomSeat] ? "player" : "opponent",
        actionsRemaining: 2,
        abilityUsed: false,
        // Played card waiting for its target: { card } (the instance), or null.
        pendingSelection: null,

        gameOver: false,
        // Winning player object, once gameOver.
        winner: null,

        // Combined turn count of both players (0 before the first turn).
        turn: 0,
        // One block per turn: { turn, side, actions }. Each action is a list of messages (a play and its effects), or one chat { name, text }.
        log: [{ turn: 0, side: null, actions: [] }]
    });
    EdenAddGameLog(EdenWho(first) === "You" ? "You go first." : `${EdenWho(first)} goes first.`);

    return EdenGameState;
}

// Deals opening hands and starts the first turn. Separate from creation so online games rebuild as: create, begin, replay moves.
function EdenBeginGame() {
    for (const seat of EdenGameState.seats) EdenPlayerDrawCard(seat, 5);
    EdenTurnStart(EdenGameState.currentTurn);
}

// Log name for a player: "You" for the local one, otherwise their name.
function EdenWho(ECPlayer) {
    return ECPlayer.control === "local" ? "You" : ECPlayer.name;
}

/*
Applies one move for the current player; returns false if illegal. All human input (clicks and online moves) goes
through here, so online games can be rebuilt by replaying moves. The AI calls the actions directly.
Moves:["play", handIndex, boardIndex | null], ["target", seat, boardIndex], ["backstage", backstageIndex], ["ability", boardIndex | null], ["draw"], ["pass"]
*/
function EdenApplyMove(move) {
    if (!EdenGameState || EdenGameState.gameOver || !Array.isArray(move)) return false;
    const current = EdenGameState[EdenGameState.currentTurn];

    switch (move[0]) {
        case "play": return EdenPlayCard(current, move[1], move[2]);
        case "target": return EdenSelectCardTarget(EdenGameState.seats[move[1]], move[2]);
        case "backstage": return EdenSelectBackstageTarget(move[1]);
        case "ability": return EdenUseAbility(current, move[1] ?? undefined);
        case "draw": return EdenDrawAction(current);
        case "pass": return EdenEndTurn(true);
    }
    return false;
}

/*
Hash of all rule state, compared after each online move to catch desyncs. Add any new rule state here.
Uses seats (not "player"/"opponent"), so it doesn't depend on which side a client shows at the bottom.
*/
function EdenGetStateChecksum() {
    const state = EdenGameState;
    const cards = list => list.map(c => c ? `${c.uid}.${c.id}.${c.entryFameBonus}.${c.exitFameBonus}` : "-").join(",");
    let text = [state.turn, state[state.currentTurn].seat, state.actionsRemaining, state.abilityUsed, state.pendingSelection?.card.uid ?? "", state.gameOver].join("|");
    for (const seat of state.seats) text += `#${seat.fame}|${seat.arrivalRepeats}|${cards(seat.deck)}|${cards(seat.hand)}|${cards(seat.board)}|${cards(seat.restingRoom)}`;

    // djb2 string hash.
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
}

// Adds a message to the current action of the current turn's log block.
function EdenAddGameLog(message) {
    if (!EdenGameState) return;
    const block = EdenGameState.log[EdenGameState.log.length - 1];
    if (block.actions.length === 0) block.actions.push([]);
    block.actions[block.actions.length - 1].push(message);
}

// Adds chat as its own log action. Not rule state, so the checksum ignores it.
function EdenAddGameChat(name, text) {
    const block = EdenGameState?.log[EdenGameState.log.length - 1];
    if (!block) return;
    EdenStartLogAction();
    block.actions[block.actions.length - 1].push({ name, text });
    // Empty action after it, so following messages don't join the chat entry.
    block.actions.push([]);
}

// Starts a new log action, so its messages group apart from the previous one's.
function EdenStartLogAction() {
    const block = EdenGameState?.log[EdenGameState.log.length - 1];
    if (!block) return;
    // Reuse the last group if it's still empty.
    if (block.actions.length === 0 || block.actions[block.actions.length - 1].length > 0) block.actions.push([]);
}

// Drawing as an action (Draw button, online "draw" move, or the AI).
function EdenDrawAction(ECPlayer) {
    if (EdenGameState.gameOver || EdenGameState.actionsRemaining <= 0 || EdenGameState.pendingSelection) return false;
    if (EdenGameState[EdenGameState.currentTurn] !== ECPlayer) return false;
    const who = EdenWho(ECPlayer);
    if (ECPlayer.deck.length === 0) {
        EdenAddGameLog(who === "You" ? "You cannot draw. Your deck is empty." : `${who} cannot draw. Their deck is empty.`);
        return false;
    }
    EdenStartLogAction();
    EdenPlayerDrawCard(ECPlayer, 1);
    EdenAddGameLog(`${who} drew a card.`);
    // Last, since using the last action ends the turn.
    EdenUseAction(ECPlayer);
    return true;
}

// Ends the current turn and starts the other player's. passed = chosen with Pass (only then is it logged).
function EdenEndTurn(passed = false) {
    if (!EdenGameState || EdenGameState.gameOver || EdenGameState.pendingSelection) return false;
    const ending = EdenGameState[EdenGameState.currentTurn];

    // New action either way, so end-of-turn effects (e.g. Kinky Neighbor) group separately.
    EdenStartLogAction();
    if (passed) EdenAddGameLog(EdenWho(ending) === "You" ? "You ended your turn." : `${EdenWho(ending)} ended their turn.`);
    EdenTurnEnd(ending);
    EdenGameState.currentTurn = EdenGameState.currentTurn === "player" ? "opponent" : "player";

    EdenTurnStart(EdenGameState.currentTurn);
    return true;
}

// Runs onTurnEnd for the ending player's board cards.
function EdenTurnEnd(ECPlayer) {
    // Each card triggers once, even if moved by an earlier effect; cards removed by one are skipped.
    for (const instance of ECPlayer.board.slice()) {
        const card = EdenGetCard(instance);
        if (card?.onTurnEnd && ECPlayer.board.includes(instance)) card.onTurnEnd(ECPlayer, instance);
    }
}

// Occupied slot indexes next to boardIndex.
function EdenGetAdjacentMembers(ECPlayer, boardIndex) {
    return [boardIndex - 1, boardIndex + 1].filter(i => i >= 0 && i < ECPlayer.board.length && ECPlayer.board[i] !== null);
}

// Whether a card named cardName is next to this copy on the board.
function EdenCheckAdjacentCardPresence(ECPlayer, instance, cardName) {
    const boardIndex = ECPlayer.board.indexOf(instance);
    if (boardIndex === -1) return false;
    return EdenGetAdjacentMembers(ECPlayer, boardIndex).some(i => EdenGetCard(ECPlayer.board[i])?.name === cardName);
}

function EdenIsEventCard(card) {
    return card?.type?.toLowerCase() === "event";
}

/*
Plays hand[handIndex] into board slot boardIndex; a member already there goes to the backstage.
Events ignore boardIndex (see EdenPlayEvent). Then starts the card's cardSelection, if it has targets.
*/
function EdenPlayCard(ECPlayer, handIndex, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState[EdenGameState.currentTurn] !== ECPlayer) return false;
    if (EdenGameState.gameOver || EdenGameState.actionsRemaining <= 0 || EdenGameState.pendingSelection) return false;

    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= ECPlayer.hand.length) return false;
    if (!EdenCanPlayCard(ECPlayer, ECPlayer.hand[handIndex])) return false;
    if (EdenIsEventCard(EdenGetCard(ECPlayer.hand[handIndex]))) return EdenPlayEvent(ECPlayer, handIndex);
    if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex >= ECPlayer.board.length) return false;

    EdenStartLogAction();
    const instance = ECPlayer.hand.splice(handIndex, 1)[0];
    const card = EdenGetCard(instance);
    const replaced = EdenGetCard(ECPlayer.board[boardIndex]);

    // Logged before placing, so the card's effect messages follow it.
    const who = EdenWho(ECPlayer);
    if (card && replaced) EdenAddGameLog(`${who} played ${card.name}, replacing ${replaced.name}.`);
    else if (card) EdenAddGameLog(`${who} played ${card.name}.`);

    EdenPlaceCard(ECPlayer, instance, boardIndex);
    EdenStartSelection(ECPlayer, instance);

    EdenUseAction(ECPlayer);
    return true;
}

// The card's own play condition (canPlay), e.g. Videos need Actresses to return.
function EdenCanPlayCard(ECPlayer, instance) {
    const card = EdenGetCard(instance);
    return !card?.canPlay || card.canPlay(ECPlayer, instance);
}

// Starts a played card's cardSelection if it has targets. Humans pick later (a "target"/"backstage" move); the AI picks randomly now.
function EdenStartSelection(ECPlayer, instance) {
    const targets = EdenGetSelectionTargets(ECPlayer, instance);
    if (targets.length === 0) return;
    if (ECPlayer.control !== "ai") EdenGameState.pendingSelection = { card: instance };
    else EdenApplyCardSelection(ECPlayer, instance, targets[Math.floor(EdenRandom() * targets.length)]);
}

/*
Targets of a card's cardSelection: board slots { ECPlayer, boardIndex }, or for SelectOwnBackstage { ECPlayer, backstageIndex }.
"Own"/"Opponent" are relative to the card's owner. The card itself is never a target.
*/
function EdenGetSelectionTargets(ECPlayer, instance) {
    const card = EdenGetCard(instance);
    if (!card?.cardSelection || !card.onCardSelected) return [];

    const rule = card.cardSelection;
    if (rule === "SelectOwnBackstage") {
        const targets = [];
        ECPlayer.restingRoom.forEach((other, i) => {
            if (other !== instance && (!card.canSelect || card.canSelect(ECPlayer, instance, other))) targets.push({ ECPlayer, backstageIndex: i });
        });
        return targets;
    }

    const opponent = ECPlayer === EdenGameState.player ? EdenGameState.opponent : EdenGameState.player;
    const sides = rule === "SelectOpponentMember" ? [opponent] : rule === "SelectAnyMember" ? [ECPlayer, opponent] : [ECPlayer];
    const targets = [];

    for (const side of sides) {
        for (let i = 0; i < side.board.length; i++) {
            if (side.board[i] === instance) continue;
            if (rule !== "SelectOwnSlot" && side.board[i] === null) continue;
            // canSelect narrows targets further (e.g. Mildred: Students only).
            if (card.canSelect && !card.canSelect(ECPlayer, instance, side.board[i])) continue;
            targets.push({ ECPlayer: side, boardIndex: i });
        }
    }
    return targets;
}

// Targets for pendingSelection (always the current player's card).
function EdenGetPendingSelectionTargets() {
    const pending = EdenGameState?.pendingSelection;
    if (!pending) return [];
    return EdenGetSelectionTargets(EdenGameState[EdenGameState.currentTurn], pending.card);
}

function EdenApplyCardSelection(ECPlayer, instance, target) {
    const card = EdenGetCard(instance);
    if (!card?.onCardSelected) return;
    const targetInstance = target.backstageIndex !== undefined ? target.ECPlayer.restingRoom[target.backstageIndex] : target.ECPlayer.board[target.boardIndex];
    const targetCard = EdenGetCard(targetInstance);
    const who = EdenWho(ECPlayer);
    EdenAddGameLog(`${who} targeted ${targetCard ? targetCard.name : `slot ${target.boardIndex + 1}`} with ${card.name}.`);
    card.onCardSelected(ECPlayer, instance, targetInstance, target.ECPlayer, target.boardIndex);
}

// Resolves pendingSelection with a board slot. targetPlayer is the board owner (either player).
function EdenSelectCardTarget(targetPlayer, boardIndex) {
    return EdenResolvePendingSelection(t => t.ECPlayer === targetPlayer && t.boardIndex === boardIndex);
}

// Same, for SelectOwnBackstage: backstageIndex is an index into the owner's backstage.
function EdenSelectBackstageTarget(backstageIndex) {
    return EdenResolvePendingSelection(t => t.backstageIndex === backstageIndex);
}

function EdenResolvePendingSelection(isPicked) {
    const pending = EdenGameState?.pendingSelection;
    if (!pending || EdenGameState.gameOver) return false;

    const target = EdenGetPendingSelectionTargets().find(isPicked);
    if (!target) return false;

    EdenGameState.pendingSelection = null;
    EdenApplyCardSelection(EdenGameState[EdenGameState.currentTurn], pending.card, target);
    // The turn end was held back while waiting (and still is if the effect started another selection, e.g. Re-Run).
    if (EdenGameState.actionsRemaining <= 0) EdenEndTurn();
    return true;
}

function EdenPlayEvent(ECPlayer, handIndex) {
    EdenStartLogAction();
    const instance = ECPlayer.hand.splice(handIndex, 1)[0];
    const card = EdenGetCard(instance);

    if (card) EdenAddGameLog(`${EdenWho(ECPlayer)} played ${card.name}.`);

    ECPlayer.restingRoom.push(instance);
    EdenRunEvent(ECPlayer, instance);
    // Last, since using the last action ends the turn.
    EdenUseAction(ECPlayer);
    return true;
}

// Runs an event's Entry Fame, onEnter and selection. Re-Run also uses it to replay a Video left in the backstage.
function EdenRunEvent(ECPlayer, instance) {
    const card = EdenGetCard(instance);
    EdenPlayerAddFame(ECPlayer, EdenGetEntryFame(instance));
    // Events never replace a member.
    if (card?.onEnter) card.onEnter(ECPlayer, instance, null);
    EdenStartSelection(ECPlayer, instance);
}

function EdenUseAction(ECPlayer) {
    EdenGameState.actionsRemaining--;
    // A pending selection delays the turn end until it resolves. A finished game has no next turn.
    if (EdenGameState.actionsRemaining <= 0 && !EdenGameState.pendingSelection && !EdenGameState.gameOver) EdenEndTurn();
}

/*
Puts a card in a board slot and applies its Entry Fame/Arrival. A member already there leaves to the backstage.
Returns the replaced card's definition, or null.
*/
function EdenPlaceCard(ECPlayer, instance, boardIndex) {
    const card = EdenGetCard(instance);
    const replaced = EdenRemoveMember(ECPlayer, boardIndex);

    // Placed before onEnter, so effects that move cards (e.g. Bouncer) include it.
    ECPlayer.board[boardIndex] = instance;
    EdenPlayerAddFame(ECPlayer, EdenGetEntryFame(instance));
    if (card?.onEnter) {
        // A pending Secretary bonus is used up by the next card with an Arrival (even another Secretary).
        const repeats = ECPlayer.arrivalRepeats;
        ECPlayer.arrivalRepeats = 0;
        if (repeats > 0) EdenAddGameLog(`${card.name}'s Arrival happens ${repeats + 1} times.`);
        for (let i = 0; i <= repeats; i++) card.onEnter(ECPlayer, instance, replaced);
    }

    // Then other board members react (onMemberEnter, e.g. College Nerd).
    for (const other of ECPlayer.board.slice()) {
        const otherCard = EdenGetCard(other);
        if (other !== instance && otherCard?.onMemberEnter && ECPlayer.board.includes(other)) otherCard.onMemberEnter(ECPlayer, other, instance);
    }

    return replaced;
}

function EdenCardHasGroup(instance, groupName) {
    return EdenGetCard(instance)?.groups?.includes(groupName) ?? false;
}

// Shifts the board one slot right; the rightmost card wraps to the left.
function EdenShiftBoardRight(ECPlayer) {
    ECPlayer.board.unshift(ECPlayer.board.pop());
}

/*
A member leaves its slot: applies Exit Fame/onLeave, then goes to the backstage (or the hand with toHand).
Returns the removed card's definition, or null if the slot was empty.
*/
function EdenRemoveMember(ECPlayer, boardIndex, toHand = false) {
    const instance = ECPlayer.board[boardIndex];
    if (instance === null) return null;

    const card = EdenGetCard(instance);
    EdenPlayerAddFame(ECPlayer, EdenGetExitFame(instance));
    if (card?.onLeave) card.onLeave(ECPlayer, instance);

    // Reset after onLeave, which may still read the copy's bonuses.
    EdenResetCardInstance(instance);
    ECPlayer.board[boardIndex] = null;
    if (toHand) EdenAddToHand(ECPlayer, instance);
    else ECPlayer.restingRoom.push(instance);
    return card ?? null;
}

// Returns a member to its owner's hand. Counts as leaving, so Exit Fame and Exit apply.
function EdenReturnToHand(ECPlayer, boardIndex) {
    const card = EdenRemoveMember(ECPlayer, boardIndex, true);
    if (card) EdenAddGameLog(`${card.name} returned to ${ECPlayer.name}'s hand.`);
    return card;
}

// Returns a random member matching filter to the hand. Returns its definition, or null.
function EdenReturnRandomMember(ECPlayer, filter) {
    const slots = ECPlayer.board.map((_, i) => i).filter(i => ECPlayer.board[i] !== null && filter(ECPlayer.board[i]));
    if (slots.length === 0) return null;
    return EdenReturnToHand(ECPlayer, slots[Math.floor(EdenRandom() * slots.length)]);
}

function EdenGetPlayerClass(ECPlayer) {
    return EdenCardClasses.find(cardClass => cardClass.id === ECPlayer.fullDeck.class);
}

// Class ability: costs an action, once per turn. targetSlot abilities need boardIndex.
function EdenUseAbility(ECPlayer, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState[EdenGameState.currentTurn] !== ECPlayer) return false;
    if (EdenGameState.gameOver || EdenGameState.actionsRemaining <= 0 || EdenGameState.abilityUsed || EdenGameState.pendingSelection) return false;

    const cardClass = EdenGetPlayerClass(ECPlayer);
    if (!cardClass?.effect) return false;
    if (cardClass.targetSlot && (boardIndex === undefined || boardIndex < 0 || boardIndex >= ECPlayer.board.length)) return false;

    EdenStartLogAction();
    EdenGameState.abilityUsed = true;
    EdenAddGameLog(`${EdenWho(ECPlayer)} used ${cardClass.abilityName}.`);
    cardClass.effect(ECPlayer, boardIndex);
    // Last, since using the last action ends the turn.
    EdenUseAction(ECPlayer);
    return true;
}

function EdenPlayerAddFame(player, amount) {
    if (!EdenGameState) return;
    if (amount == 0) return;
    player.fame = (player.fame || 0) + amount;
    if (player.fame >= EdenWinningFame && !EdenGameState.gameOver) EdenEndGame(player);
}

const EdenWinningFame = 100;

// Every action checks gameOver, so nothing can be played after this; the UI shows the winner pop-up.
function EdenEndGame(winner) {
    EdenGameState.gameOver = true;
    EdenGameState.winner = winner;
    EdenGameState.pendingSelection = null;
    EdenAddGameLog(`${EdenWho(winner)} reached ${EdenWinningFame} Fame and won!`);
}

const EdenMaxHandSize = 10;

function EdenPlayerDrawCard(player, amount) {
    if (!EdenGameState) return false;

    for (let i = 0; i < amount; i++) {
        if (player.deck.length === 0) return false;
        const instance = player.deck.shift();
        if (!instance) return false;
        EdenAddToHand(player, instance);
    }
    return true;
}

// Adds a card to the hand; with a full hand it goes to the Backstage instead.
function EdenAddToHand(player, instance) {
    if (player.hand.length < EdenMaxHandSize) {
        player.hand.push(instance);
        return;
    }
    player.restingRoom.push(instance);
    const who = EdenWho(player);
    EdenAddGameLog(`${who === "You" ? "Your" : `${who}'s`} hand is full, so ${EdenGetCard(instance)?.name ?? "the card"} went to the Backstage.`);
}

// Moves a random deck card matching filter to the hand. Returns its definition, or null.
function EdenDrawMatchingCard(player, filter) {
    const matches = player.deck.filter(filter);
    if (matches.length === 0) return null;
    const instance = matches[Math.floor(EdenRandom() * matches.length)];
    player.deck.splice(player.deck.indexOf(instance), 1);
    EdenAddToHand(player, instance);
    return EdenGetCard(instance);
}

function EdenTurnStart(turnPlayer) {
    if (!EdenGameState || EdenGameState.gameOver) return false;
    EdenGameState.actionsRemaining = 2;
    EdenGameState.abilityUsed = false;
    EdenGameState.turn++;
    EdenGameState.log.push({ turn: EdenGameState.turn, side: turnPlayer, actions: [] });
    let ECPlayer = EdenGameState[turnPlayer];
    ECPlayer.turnNumber++;
    EdenPlayerDrawCard(ECPlayer, 1);
    if (ECPlayer.control === "ai") AITurn(ECPlayer);
}

/*
AI turn, one action every 0.5s: play a random playable card, else draw, else pass.
Its last action ends the turn (EdenUseAction), which also ends this loop.
*/
async function AITurn(ECPlayer) {
    const gameState = EdenGameState;
    const turn = gameState.turn;
    EdenShowGameBoard();

    while (EdenGameState === gameState && gameState.turn === turn && !gameState.gameOver) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Stop if the game was closed or restarted during the delay.
        if (EdenGameState !== gameState || gameState.gameOver) return;
        if (!aiPlayCard(ECPlayer) && !EdenDrawAction(ECPlayer)) EdenEndTurn(true);
        EdenShowGameBoard();
    }
}

function aiPlayCard(ECPlayer) {
    const availableCards = ECPlayer.hand.filter(instance => EdenCanPlayCard(ECPlayer, instance));
    if (availableCards.length === 0) return false;
    const randomIndex = Math.floor(EdenRandom() * availableCards.length);
    const instance = availableCards[randomIndex];
    const randomBoardIndex = Math.floor(EdenRandom() * ECPlayer.board.length);
    return EdenPlayCard(ECPlayer, ECPlayer.hand.indexOf(instance), randomBoardIndex);
}

function EdenCheckCardPresence(player, cardName) {
    return player.board.some(instance => {
        const card = EdenGetCard(instance);
        return card?.name === cardName;
    });
}

function EdenCheckGroupCountPresence(player, groupName) {
    return player.board.filter(instance => {
        const card = EdenGetCard(instance);
        return card?.groups?.includes(groupName);
    }).length;
}

// Local game: the player in seat 0, the AI with EdenDefaultDeck in seat 1.
function EdenCreateLocalGame(deck) {
    // Host game names: the player's nickname, and the dealer NPC's (eden-room.js).
    const playerName = typeof Player !== "undefined" ? Player.Nickname || Player.Name : "";
    const npcName = typeof EdenCardClubDealer !== "undefined" ? EdenCardClubDealer?.Nickname || EdenCardClubDealer?.Name : "";
    EdenCreateGameState({
        seed: EdenNewSeed(),
        decks: [deck, EdenDefaultDeck],
        names: [playerName || "Player", npcName || "Opponent"],
        controls: ["local", "ai"],
        localSeat: 0
    });
    EdenBeginGame();
}

function EdenSummonCard(ECPlayer, cardName, boardIndex) {
    if (!EdenGameState) return false;
    const card = EdenCardDatabase.find(c => c.name === cardName);
    if (!card) return false;
    EdenPlaceCard(ECPlayer, EdenCreateCardInstance(card.id), boardIndex);
    return true;
}