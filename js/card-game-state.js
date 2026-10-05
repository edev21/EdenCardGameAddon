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
        abilityUsed: false,

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
    return EdenDrawAction(EdenGameState.player);
}

/*
Draws one card as an action, used by both the Draw button and the AI.
*/
function EdenDrawAction(ECPlayer) {
    if (EdenGameState.actionsRemaining <= 0) return false;
    const isPlayer = ECPlayer === EdenGameState.player;
    if (ECPlayer.deck.length === 0) {
        EdenAddGameLog(isPlayer ? "You cannot draw. Your deck is empty." : "The opponent cannot draw. Their deck is empty.");
        return false;
    }
    EdenPlayerDrawCard(ECPlayer, 1);
    EdenUseAction(ECPlayer);
    EdenAddGameLog(isPlayer ? "You drew a card." : "The opponent drew a card.");
    return true;
}

/*
Ends the player's turn and starts the opponent's.
*/
function EdenEndTurn() {
    if (!EdenGameState) return false;
    if (EdenGameState.currentTurn !== "player") return false;

    EdenGameState.currentTurn = EdenGameState.currentTurn === "player" ? "opponent" : "player";

    EdenTurnStart(EdenGameState.currentTurn);
    EdenAddGameLog("You ended your turn.");
    return true;
}

function EdenIsEventCard(card) {
    return card?.type?.toLowerCase() === "event";
}

/*
Plays the card at handIndex into the player's board slot boardIndex.
A member already in that slot is replaced and sent to the resting room.
Event cards ignore boardIndex: their effect runs and they go straight to the resting room.
*/
function EdenPlayCard(ECPlayer, handIndex, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState[EdenGameState.currentTurn] !== ECPlayer) return false;
    if (EdenGameState.actionsRemaining <= 0) return false;

    if (handIndex < 0 || handIndex >= ECPlayer.hand.length) return false;
    if (EdenIsEventCard(EdenGetCardById(ECPlayer.hand[handIndex]))) return EdenPlayEvent(ECPlayer, handIndex);
    if (boardIndex < 0 || boardIndex >= ECPlayer.board.length) return false;

    const cardId = ECPlayer.hand.splice(handIndex, 1)[0];
    const replaced = EdenPlaceCard(ECPlayer, cardId, boardIndex);
    const card = EdenGetCardById(cardId);

    EdenUseAction(ECPlayer);

    const who = ECPlayer === EdenGameState.player ? "You" : "The opponent";
    if (card && replaced) EdenAddGameLog(`${who} played ${card.name}, replacing ${replaced.name}.`);
    else if (card) EdenAddGameLog(`${who} played ${card.name}.`);

    return true;
}

function EdenPlayEvent(ECPlayer, handIndex) {
    const cardId = ECPlayer.hand.splice(handIndex, 1)[0];
    const card = EdenGetCardById(cardId);

    EdenUseAction(ECPlayer);
    if (card) EdenAddGameLog(`${ECPlayer === EdenGameState.player ? "You" : "The opponent"} played ${card.name}.`);

    EdenPlayerAddFame(ECPlayer, card?.enterFame ?? 0);
    if (card?.onEnter) card.onEnter(ECPlayer);
    ECPlayer.restingRoom.push(cardId);
    return true;
}

function EdenUseAction(ECPlayer) {
    EdenGameState.actionsRemaining--;
    if (EdenGameState.actionsRemaining <= 0) EdenEndTurn();
}

/*
Puts a card into a board slot, applying its enter Fame/effect.
A member already in that slot leaves to the resting room. Returns the replaced card, or null.
*/
function EdenPlaceCard(ECPlayer, cardId, boardIndex) {
    const replacedId = ECPlayer.board[boardIndex];
    const card = EdenGetCardById(cardId);
    const replaced = replacedId !== null ? EdenGetCardById(replacedId) : null;
    EdenPlayerAddFame(ECPlayer, replaced?.leaveFame ?? 0);
    if (replaced?.onLeave) replaced.onLeave(ECPlayer);

    
    EdenPlayerAddFame(ECPlayer, card?.enterFame ?? 0);
    if (card?.onEnter) card.onEnter(ECPlayer);

    if (replacedId !== null) ECPlayer.restingRoom.push(replacedId);
    ECPlayer.board[boardIndex] = cardId;
    return replaced;
}

function EdenGetPlayerClass(ECPlayer) {
    return EdenCardClasses.find(cardClass => cardClass.id === ECPlayer.fullDeck.class);
}

/*
Uses the player's class ability. Costs one action and can be used once per turn.
Abilities with targetSlot need the board slot the player chose.
*/
function EdenUseAbility(ECPlayer, boardIndex) {
    if (!EdenGameState) return false;
    if (EdenGameState[EdenGameState.currentTurn] !== ECPlayer) return false;
    if (EdenGameState.actionsRemaining <= 0 || EdenGameState.abilityUsed) return false;

    const cardClass = EdenGetPlayerClass(ECPlayer);
    if (!cardClass?.effect) return false;
    if (cardClass.targetSlot && (boardIndex === undefined || boardIndex < 0 || boardIndex >= ECPlayer.board.length)) return false;

    EdenUseAction(ECPlayer);
    EdenGameState.abilityUsed = true;
    EdenAddGameLog(`${ECPlayer === EdenGameState.player ? "You" : "The opponent"} used ${cardClass.abilityName}.`);
    cardClass.effect(ECPlayer, boardIndex);
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
    EdenGameState.abilityUsed = false;
    let ECPlayer = EdenGameState[turnPlayer];
    ECPlayer.turnNumber++;
    EdenPlayerDrawCard(ECPlayer, 1);
    if (!ECPlayer.online) AITurn(ECPlayer);
}

/*
Plays the AI's turn: each action plays a card if it can, otherwise draws.
The board is redrawn after every action, 0.2 seconds apart.
*/
async function AITurn(ECPlayer) {
    const gameState = EdenGameState;
    if (!gameState || gameState.currentTurn !== "opponent") return false;
    EdenShowGameBoard();

    while (gameState.actionsRemaining > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Stop if the game was closed or restarted during the delay.
        if (EdenGameState !== gameState) return false;
        if (!aiPlayCard(ECPlayer) && !EdenDrawAction(ECPlayer)) break;
        EdenShowGameBoard();
    }

    gameState.currentTurn = "player";
    EdenAddGameLog("The opponent ended their turn.");
    EdenTurnStart("player");
    EdenShowGameBoard();
    return true;
}

function aiPlayCard(ECPlayer) {
    const availableCards = ECPlayer.hand.filter(cardId => {
        const card = EdenGetCardById(cardId);
        return !card?.canPlay || card.canPlay(ECPlayer);
    });
    if (availableCards.length === 0) return false;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const cardId = availableCards[randomIndex];
    const randomBoardIndex = Math.floor(Math.random() * ECPlayer.board.length);
    return EdenPlayCard(ECPlayer, ECPlayer.hand.indexOf(cardId), randomBoardIndex);
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

function EdenSummonCard(ECPlayer, cardName, boardIndex) {
    if (!EdenGameState) return false;
    const card = EdenCardDatabase.find(c => c.name === cardName);
    if (!card) return false;
    EdenPlaceCard(ECPlayer, card.id, boardIndex);
    return true;
}