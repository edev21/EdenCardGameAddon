/*
Card game UI.

This file is responsible only for:
- Creating and displaying the game UI
- Showing the deck selection screen
- Rendering the current game state
- Handling UI buttons

Game state and game rules are handled by card-game-state.js.
*/

let EdenGameContainer = null;
let EdenGameContentElement = null;
let EdenGameOpenButtonElement = null;

// Position in the player's hand of the card waiting for a slot, or null.
let EdenSelectedHandIndex = null;

/*
Finds or creates the main game container.
*/
function EdenEnsureGameContainer() {
    let container = document.getElementById("eden-card-game-game");

    if (!container) {
        container = document.createElement("div");
        container.id = "eden-card-game-game";
        document.body.appendChild(container);
    }

    EdenGameContainer = container;
    EdenGameContentElement = container.querySelector(".eden-game-content");

    if (!EdenGameContentElement) {
        container.innerHTML = "";
        EdenGameContentElement = EdenCreateElement("div", "eden-game-content");
        container.appendChild(EdenGameContentElement);
    }
    return EdenGameContainer;
}

/*
Removes everything currently displayed inside the game.
*/
function EdenClearGameScreen() {
    EdenGameContentElement.innerHTML = "";
}

/*
Finds or creates the standalone "Open Game" button.
*/
function EdenEnsureGameOpenButton() {
    let button = document.getElementById("eden-open-game-button");

    if (!button) {
        button = document.createElement("button");
        button.id = "eden-open-game-button";
        button.className = "eden-open-game-button";
        button.textContent = "Open Game";
        button.addEventListener("click", EdenOpenCardGame);
        document.body.appendChild(button);
    }
    EdenGameOpenButtonElement = button;
    return EdenGameOpenButtonElement;
}

function EdenShowGameOpenButton() {
    EdenEnsureGameOpenButton().classList.remove("eden-open-game-button-hidden");
}

function EdenHideGameOpenButton() {
    EdenEnsureGameOpenButton().classList.add("eden-open-game-button-hidden");
}

/*
Initializes the game UI.
*/
function EdenInitializeGame() {
    EdenEnsureGameContainer();
    EdenShowGameOpenButton();

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || EdenSelectedHandIndex === null) return;
        EdenSelectedHandIndex = null;
        EdenShowGameBoard();
    });
}

/*
Opens the game UI.
The game state itself is handled by card-game-state.js.
*/
function EdenOpenCardGame() {
    EdenEnsureGameContainer();

    document.documentElement.classList.add("eden-card-game-game-open");
    EdenGameContainer.classList.add("eden-card-game-game-visible");

    EdenHideGameOpenButton();

    const gameState = EdenGameState;

    if (gameState) EdenShowGameBoard();
    else EdenShowGameDeckSelect();
}

/*
Closes the game UI.
The game state is also reset so opening the game again starts
from deck selection.
*/
function EdenCloseCardGame() {
    document.documentElement.classList.remove("eden-card-game-game-open");
    EdenShowGameOpenButton();
    EdenGameState = null;
    EdenSelectedHandIndex = null;
    if (!EdenGameContainer) return;
    EdenGameContainer.classList.remove("eden-card-game-game-visible");
}

/*
Displays the deck selection screen.
*/
function EdenShowGameDeckSelect() {
    EdenClearGameScreen();

    const screen = EdenCreateElement("div", "eden-deck-builder-screen");
    const title = EdenCreateElement(
        "h1",
        "eden-deck-builder-title",
        "Select Your Deck"
    );

    const deckList = EdenCreateElement("div", "eden-deck-list");

    const decks = EdenGetDecks();

    if (decks.length === 0) {
        deckList.appendChild(
            EdenCreateElement(
                "div",
                "eden-deck-list-empty",
                "You need to build a deck first. Open the Deck Builder to create one."
            )
        );
    } else {
        for (const deck of decks) deckList.appendChild(EdenCreateGameDeckSelectItem(deck));
    }

    screen.appendChild(title);
    screen.appendChild(deckList);
    EdenGameContentElement.appendChild(screen);
}

/*
Creates one deck-selection item.
*/
function EdenCreateGameDeckSelectItem(deck) {
    const item = EdenCreateElement("button", "eden-deck-list-item");

    const name = EdenCreateElement(
        "div",
        "eden-deck-list-item-name",
        deck.name
    );

    const className = EdenGetClassName(deck.class);
    const cardCount = EdenGetTotalCards(deck);
    const information = EdenCreateElement(
        "div",
        "eden-deck-list-item-information",
        `${className} • ${cardCount}/${EdenDeckSize} cards`
    );

    item.appendChild(name);
    item.appendChild(information);
    item.addEventListener("click", () => {
        EdenStartGame(deck);
    });
    return item;
}

/*
Starts a game using the selected deck.
The actual creation of the game state happens in
card-game-state.js.
*/
function EdenStartGame(deck) {
    EdenSelectedHandIndex = null;
    EdenCreateGameState(deck);
    EdenPlayerDrawCard(EdenGameState.player, 5);
    EdenPlayerDrawCard(EdenGameState.opponent, 5);
    EdenShowGameBoard();
    EdenTurnStart("player");
}

/*
Renders the entire game board using the current game state.
*/
function EdenShowGameBoard() {
    const gameState = EdenGameState;
    if (!gameState) {
        EdenShowGameDeckSelect();
        return;
    }

    EdenClearGameScreen();

    const screen = EdenCreateElement("div", "eden-game-screen");
    const field = EdenCreateElement("div", "eden-game-field");

    field.appendChild(EdenCreateGamePlayerPanel("opponent"));
    field.appendChild(EdenCreateGameHandRow("opponent"));
    field.appendChild(EdenCreateGameBoardRow("opponent"));
    field.appendChild(EdenCreateGameCenterInfo());
    field.appendChild(EdenCreateGameBoardRow("player"));
    field.appendChild(EdenCreateGameHandRow("player"));
    field.appendChild(EdenCreateGamePlayerPanel("player"));

    screen.appendChild(field);
    screen.appendChild(EdenCreateGameChatPanel());

    EdenGameContentElement.appendChild(screen);
}

/*
Creates a player's hand.
This function only displays the state.
It does not modify the state.
*/
function EdenCreateGameHandRow(side) {
    const gameState = EdenGameState;
    const row = EdenCreateElement(
        "div",
        `eden-game-hand-row eden-game-hand-row-${side}`
    );

    let index = 0;

    for (let handIndex = 0; handIndex < gameState[side].hand.length; handIndex++) {
        const cardId = gameState[side].hand[handIndex];
        const card = EdenGetCardById(cardId);
        if (!card) continue;

        const cardElement = EdenCardGameRenderCard(card, {
            clickable: side === "player"
        });

        // The CSS fans the cards out (and overlaps them when the hand is wide) from these.
        cardElement.style.setProperty("--eden-hand-index", String(index++));

        if (side === "player") {
            if (handIndex === EdenSelectedHandIndex) cardElement.classList.add("eden-game-hand-card-selected");

            cardElement.addEventListener("click", () => {
                EdenHandleCardClick(handIndex);
            });
        }

        cardElement.addEventListener("contextmenu", event => {
            event.preventDefault();
            EdenShowCardPreview(card);
        });

        row.appendChild(cardElement);
    }

    row.style.setProperty("--eden-hand-count", String(index));
    return row;
}

/*
Selects the clicked hand card (or deselects it if it is already selected).
The card is only played once the player picks a board slot.
*/
function EdenHandleCardClick(handIndex) {
    const gameState = EdenGameState;
    if (gameState.currentTurn !== "player" || gameState.actionsRemaining <= 0) return;

    EdenSelectedHandIndex = EdenSelectedHandIndex === handIndex ? null : handIndex;
    EdenShowGameBoard();
}

/*
Plays the selected hand card into the clicked slot on the player's board.
*/
function EdenHandleSlotClick(boardIndex) {
    if (EdenSelectedHandIndex === null) return;

    EdenPlayCard(EdenSelectedHandIndex, boardIndex);
    EdenSelectedHandIndex = null;
    EdenShowGameBoard();
}

/*
Creates one player's board.
*/
function EdenCreateGameBoardRow(side) {
    const gameState = EdenGameState;
    const row = EdenCreateElement(
        "div",
        `eden-game-board-row eden-game-board-row-${side}`
    );

    for (let i = 0; i < 4; i++) {
        const slot = EdenCreateElement("div", "eden-game-board-slot");
        const boardCard = gameState[side].board[i];

        if (boardCard) {
            const card = EdenGetCardById(boardCard);
            if (card) {
                slot.classList.add("eden-game-board-slot-filled");
                slot.appendChild(EdenCardGameRenderCard(card));
            }
        } else {
            slot.appendChild(
                EdenCreateElement(
                    "div",
                    "eden-game-board-slot-placeholder",
                    String(i + 1)
                )
            );
        }

        // With a hand card selected, every slot on the player's side (empty or not) is a valid target.
        if (side === "player" && EdenSelectedHandIndex !== null) {
            slot.classList.add("eden-game-board-slot-target");
            slot.addEventListener("click", () => {
                EdenHandleSlotClick(i);
            });
        }

        row.appendChild(slot);
    }
    return row;
}

/*
Creates the square panel beside a player's board: name, fame and ability button.
*/
function EdenCreateGamePlayerPanel(side) {
    const gameState = EdenGameState;
    const panel = EdenCreateElement(
        "div",
        `eden-game-player-panel eden-game-player-panel-${side}`
    );

    if (gameState.currentTurn === side) panel.classList.add("eden-game-player-panel-active");

    panel.appendChild(
        EdenCreateElement(
            "div",
            "eden-game-player-name",
            side === "player" ? "You" : "Opponent"
        )
    );

    const fame = EdenCreateElement("div", "eden-game-player-fame");
    fame.appendChild(EdenCreateElement("div", "eden-game-player-fame-value", String(gameState[side].fame)));
    fame.appendChild(EdenCreateElement("div", "eden-game-player-fame-label", "Fame"));
    panel.appendChild(fame);

    const abilityButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-ability-button",
        "Use Ability"
    );

    // Abilities have no game logic yet.
    abilityButton.disabled = true;
    abilityButton.title = "Abilities are not available yet.";
    panel.appendChild(abilityButton);

    return panel;
}

/*
Creates the information shown between the two players.
*/
function EdenCreateGameCenterInfo() {
    const gameState = EdenGameState;
    const center = EdenCreateElement("div", "eden-game-center-info");

    center.appendChild(
        EdenCreateElement(
            "div",
            "eden-game-turn-label",
            gameState.currentTurn === "player" ? "Your Turn" : "Opponent's Turn"
        )
    );

    center.appendChild(
        EdenCreateElement(
            "div",
            "eden-game-deck-counts"
        )
    );

    center.appendChild(
        EdenCreateElement(
            "div",
            "eden-game-actions",
            `Actions: ${gameState.actionsRemaining}`
        )
    );

    const selectedCard = EdenSelectedHandIndex === null
        ? null
        : EdenGetCardById(gameState.player.hand[EdenSelectedHandIndex]);

    if (selectedCard) {
        center.appendChild(
            EdenCreateElement(
                "div",
                "eden-game-hint",
                `Choose a slot for ${selectedCard.name} (Esc to cancel)`
            )
        );
    }
    return center;
}

/*
Creates the game log and action buttons.
*/
function EdenCreateGameChatPanel() {
    const gameState = EdenGameState;

    const panel = EdenCreateElement("aside", "eden-game-chat-panel");

    const chatLog = EdenCreateElement("div", "eden-game-chat-log");

    if (gameState.log.length === 0) {
        chatLog.appendChild(
            EdenCreateElement(
                "div",
                "eden-game-chat-placeholder",
                "Game log will appear here."
            )
        );
    } else {
        for (const message of gameState.log) {
            chatLog.appendChild(
                EdenCreateElement(
                    "div",
                    "eden-game-chat-message",
                    message
                )
            );
        }
    }

    const buttons = EdenCreateElement("div", "eden-game-action-buttons");

    const drawButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Draw"
    );

    drawButton.disabled = gameState.currentTurn !== "player";

    drawButton.addEventListener("click", () => {
        if (EdenDrawCardButton()) EdenShowGameBoard();
    });

    const passButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Pass"
    );

    passButton.disabled = gameState.currentTurn !== "player";

    passButton.addEventListener("click", () => {
        EdenSelectedHandIndex = null;
        if (EdenEndTurn()) EdenShowGameBoard();
    });

    const settingsButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Settings"
    );

    settingsButton.disabled = true;

    const exitButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button eden-game-exit-button",
        "Exit Game"
    );

    exitButton.addEventListener("click", EdenCloseCardGame);

    buttons.appendChild(drawButton);
    buttons.appendChild(passButton);
    buttons.appendChild(settingsButton);
    buttons.appendChild(exitButton);

    panel.appendChild(chatLog);
    panel.appendChild(buttons);

    return panel;
}

document.addEventListener("DOMContentLoaded", EdenInitializeGame);
