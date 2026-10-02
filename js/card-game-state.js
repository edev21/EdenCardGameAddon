/*
Card game state.
This file is responsible for:
- Creating the game state
- Storing the current game state
- Modifying game state
- Basic game actions
The UI is handled by card-game.js.
*/

let EdenGameState = null;

/*
Creates a shuffled copy of an array.
*/
function EdenShuffleArray(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/*
Creates the initial game state.
*/
function EdenCreateGameState(deck) {
    const playerDeck = EdenShuffleArray(deck.cards);

    const opponentFullDeck = EdenDefaultDeck;
    const opponentDeck = EdenShuffleArray(opponentFullDeck.cards);

    const startingPlayer = Math.random() < 0.5 ? "player" : "opponent";

    EdenGameState = {
        currentTurn: startingPlayer,
        actionsRemaining: 2,

        gameOver: false,
        winner: null,

        player: {
            name: "Player",
            fullDeck: deck,
            deck: playerDeck,
            hand: [],
            board: [null, null, null, null],
            restingRoom: [],
            fame: 0,
            turnNumber: 0
        },

        opponent: {
            name: "Opponent",
            fullDeck: opponentFullDeck,
            deck: opponentDeck,
            hand: [],
            board: [null, null, null, null],
            restingRoom: [],
            fame: 0,
            turnNumber: 0
        },

        log: []
    };
    EdenAddGameLog(startingPlayer === "player" ? "You go first." : "The opponent goes first.");

    return EdenGameState;
}

/*
Adds a message to the game log.
*/
function EdenAddGameLog(message) {
    if (!EdenGameState) return;
    EdenGameState.log.push(message);
}

/*
Draws a card for the player.
This is currently exposed to the UI.
*/
function EdenDrawCardButton() {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "player") return false;
    if (EdenGameState.player.deck.length === 0) {
        EdenAddGameLog("You cannot draw. Your deck is empty.");
        return false;
    }
    return EdenPlayerDrawCard(EdenGameState.player, 1);
}

/*
Ends the player's turn.
The opponent turn is intentionally not implemented yet.
*/
function EdenEndTurn() {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "player") return false;

    EdenGameState.currentTurn = "opponent";
    EdenGameState.actionsRemaining = 2;

    EdenAddGameLog("You ended your turn.");
    return true;
}

/*
Plays the card at handIndex into the player's board slot boardIndex.
A member already in that slot is replaced and sent to the resting room.
The actual card effects will be added later.
*/
function EdenPlayCard(handIndex, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "player") return false;
    if (EdenGameState.actionsRemaining <= 0) return false;

    const player = EdenGameState.player;
    if (handIndex < 0 || handIndex >= player.hand.length) return false;
    if (boardIndex < 0 || boardIndex >= player.board.length) return false;

    const cardId = player.hand.splice(handIndex, 1)[0];
    const replacedId = player.board[boardIndex];

    if (replacedId !== null) player.restingRoom.push(replacedId);
    player.board[boardIndex] = cardId;

    EdenGameState.actionsRemaining--;

    const card = EdenGetCardById(cardId);
    const replaced = replacedId !== null ? EdenGetCardById(replacedId) : null;

    if (card && replaced) EdenAddGameLog(`You played ${card.name}, replacing ${replaced.name}.`);
    else if (card) EdenAddGameLog(`You played ${card.name}.`);

    return true;
}

function EdenPlayerDrawCard(player, amount) {
    if (!EdenGameState) return false;

    for (let i = 0; i < amount; i++) {
        if (player.deck.length === 0) return false;
        const cardId = player.deck.shift();
        if (!cardId) return false;
        player.hand.push(cardId);
    }
    return true;
}

function EdenTurnStart(turnPlayer) {
    if (!EdenGameState) return false;
    let ECPlayer = EdenGameState[turnPlayer];
    ECPlayer.turnNumber++;
    EdenPlayerDrawCard(ECPlayer, 1);
}
