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
            online: true,
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
            online: false,
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

    EdenGameState.currentTurn = EdenGameState.currentTurn === "player" ? "opponent" : "player";

    EdenTurnStart(EdenGameState.currentTurn);
    EdenAddGameLog("You ended your turn.");
    return true;
}

/*
Plays the card at handIndex into the player's board slot boardIndex.
A member already in that slot is replaced and sent to the resting room.
The actual card effects will be added later.
*/
function EdenPlayCard(ECPlayer, handIndex, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "player") return false;
    if (EdenGameState.actionsRemaining <= 0) return false;

    if (handIndex < 0 || handIndex >= ECPlayer.hand.length) return false;
    if (boardIndex < 0 || boardIndex >= ECPlayer.board.length) return false;

    const cardId = ECPlayer.hand.splice(handIndex, 1)[0];
    const replacedId = ECPlayer.board[boardIndex];
    const card = EdenGetCardById(cardId);
    const replaced = replacedId !== null ? EdenGetCardById(replacedId) : null;
    EdenPlayerAddFame(ECPlayer, card?.enterFame ?? 0);
    if (card?.onEnter) card.onEnter(ECPlayer);
    EdenPlayerAddFame(ECPlayer, replaced?.leaveFame ?? 0);
    if (replaced?.onLeave) replaced.onLeave(ECPlayer);

    if (replacedId !== null) ECPlayer.restingRoom.push(replacedId);
    ECPlayer.board[boardIndex] = cardId;

    EdenGameState.actionsRemaining--;


    if (card && replaced) EdenAddGameLog(`You played ${card.name}, replacing ${replaced.name}.`);
    else if (card) EdenAddGameLog(`You played ${card.name}.`);

    return true;
}

function EdenPlayerAddFame(player, amount) {
    if (!EdenGameState) return;
    if (amount == 0) return;
    player.fame = (player.fame || 0) + amount;
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
    EdenGameState.actionsRemaining = 2;
    let ECPlayer = EdenGameState[turnPlayer];
    ECPlayer.turnNumber++;
    EdenPlayerDrawCard(ECPlayer, 1);
    if (!ECPlayer.online) AITurn(ECPlayer);
}

async function AITurn(ECPlayer) {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "opponent") return false;

    EdenGameState.currentTurn = "player";
    EdenGameState.actionsRemaining = 2;

    await aiPlayCard(ECPlayer);
    if (EdenGameState.actionsRemaining > 0) {
        EdenPlayerDrawCard(ECPlayer, 1);
        EdenGameState.actionsRemaining--;
    }
    if (EdenGameState.actionsRemaining > 0) await aiPlayCard(ECPlayer);

    EdenEndTurn();
}

async function aiPlayCard(ECPlayer) {
    while (EdenGameState.actionsRemaining > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const availableCards = ECPlayer.hand.filter(cardId => {
            const card = EdenGetCardById(cardId);
            return !card?.canPlay || card.canPlay(ECPlayer);
        });
        if (availableCards.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableCards.length);
        const cardId = availableCards[randomIndex];
        const randomBoardIndex = Math.floor(Math.random() * ECPlayer.board.length);
        EdenPlayCard(ECPlayer, ECPlayer.hand.indexOf(cardId), randomBoardIndex);
    }
}

function EdenCheckCardPresence(player, cardName) {
    return player.board.some(cardId => {
        const card = EdenGetCardById(cardId);
        return card?.name === cardName;
    });
}

function EdenCheckGroupCountPresence(player, groupName) {
    return player.board.filter(cardId => {
        const card = EdenGetCardById(cardId);
        return card?.groups?.includes(groupName);
    }).length;
}

function EdenSummonCard(ECPlayer, cardName) {
    if (!EdenGameState) return false;
    const card = EdenCardDatabase.find(c => c.name === cardName);
    if (!card) return false;
    ECPlayer.board.push(card.id);
    return true;
}