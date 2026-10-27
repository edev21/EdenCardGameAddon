// Card game UI: deck selection, board rendering and input. State and rules live in card-game-state.js.

// The addon's own assets folder, resolved from this script's URL.
const EdenAddonAssets = document.currentScript instanceof HTMLScriptElement ? new URL("../assets/", document.currentScript.src).href : "assets/";

let EdenGameContainer = null;
let EdenGameContentElement = null;
let EdenGameOpenButtonElement = null;

// Hand index of the selected card waiting for a board slot, or null.
let EdenSelectedHandIndex = null;

// Whether the class ability is waiting for a board slot.
let EdenAbilitySelecting = false;

// Whether the Backstage window is open.
let EdenRestingRoomOpen = false;

// Chat box text, kept across board redraws.
let EdenGameChatDraft = "";
const EdenGameChatMaxLength = 300;

// Card definition merged with this copy's modified stats, for display.
function EdenGetCardView(instance) {
    const card = EdenGetCard(instance);
    if (!card || (!instance.entryFameBonus && !instance.exitFameBonus)) return card;
    return {
        ...card,
        entryFame: card.entryFame === undefined && !instance.entryFameBonus ? undefined : EdenGetEntryFame(instance),
        exitFame: card.exitFame === undefined && !instance.exitFameBonus ? undefined : EdenGetExitFame(instance),
        // Lets the renderer mark changed stats.
        entryFameBonus: instance.entryFameBonus,
        exitFameBonus: instance.exitFameBonus
    };
}

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

function EdenClearGameScreen() {
    EdenGameContentElement.innerHTML = "";
}

// Floating "Open Game" button, used outside the host game (hidden inside it by CSS).
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

function EdenInitializeGame() {
    EdenEnsureGameContainer();
    EdenShowGameOpenButton();

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || (EdenSelectedHandIndex === null && !EdenAbilitySelecting)) return;
        EdenSelectedHandIndex = null;
        EdenAbilitySelecting = false;
        EdenShowGameBoard();
    });
}

// Shows the board if a game exists, otherwise deck selection.
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
Hides the game. Local and finished games are discarded; a running online game keeps going
and can be reopened from the chat room's Eden menu.
*/
function EdenCloseCardGame() {
    document.documentElement.classList.remove("eden-card-game-game-open");
    EdenShowGameOpenButton();
    EdenSelectedHandIndex = null;
    EdenAbilitySelecting = false;
    EdenRestingRoomOpen = false;
    if (!EdenGameState?.online || EdenGameState.gameOver) {
        if (EdenGameState?.online) EdenOnlineClearGame();
        EdenGameState = null;
    }
    if (!EdenGameContainer) return;
    EdenGameContainer.classList.remove("eden-card-game-game-visible");
}

function EdenIsGameOpen() {
    return EdenGameContainer?.classList.contains("eden-card-game-game-visible") ?? false;
}

// All local input goes through here: applies the move (EdenApplyMove) and, online, broadcasts it.
function EdenSubmitMove(move) {
    if (!EdenApplyMove(move)) return false;
    if (EdenGameState.online) EdenOnlineSendMove(move);
    return true;
}

// Whether this computer can act now (false for spectators and on the other player's turn).
function EdenIsLocalTurn() {
    const gameState = EdenGameState;
    return !!gameState && !gameState.gameOver && gameState[gameState.currentTurn].control === "local";
}

// Name shown on a player's panel (for the AI, the dealer NPC's name).
function EdenGetPanelName(ECPlayer) {
    return ECPlayer.name;
}

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
    const waitingText = EdenOnlineGetDeckWaitingText();

    if (waitingText) deckList.appendChild(EdenCreateElement("div", "eden-deck-list-empty", waitingText));
    else if (decks.length === 0) {
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
        if (EdenOnlineIsPickingDeck()) EdenOnlinePickDeck(deck);
        else EdenStartGame(deck);
    });
    return item;
}

// Starts a local game against the AI.
function EdenStartGame(deck) {
    EdenSelectedHandIndex = null;
    EdenAbilitySelecting = false;
    EdenRestingRoomOpen = false;
    EdenCreateLocalGame(deck);
    EdenShowGameBoard();
}

const EdenGameBackgroundFolder = "Backgrounds/";

// The player's Club Card background from the host game, or its default board.
function EdenGetGameBackgroundUrl() {
    // Player only exists inside the host game.
    const background = typeof Player !== "undefined" && Player.Game?.ClubCard?.Background ? Player.Game.ClubCard.Background : "ClubCardPlayBoard1";
    return `${EdenGameBackgroundFolder}${background}.jpg`;
}

// Redraws the whole screen from EdenGameState. Called after every state change.
function EdenShowGameBoard() {
    const gameState = EdenGameState;
    if (!gameState) {
        EdenShowGameDeckSelect();
        return;
    }

    // Redraws happen on every move (including the other player's), so restore the chat box focus.
    const chatFocused = !!document.activeElement?.classList.contains("eden-game-chat-input");
    EdenClearGameScreen();

    const screen = EdenCreateElement("div", "eden-game-screen");
    screen.style.backgroundImage = `url("${EdenGetGameBackgroundUrl()}")`;
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
    if (EdenRestingRoomOpen || EdenIsPickingBackstage()) screen.appendChild(EdenCreateRestingRoomWindow());
    if (gameState.gameOver) screen.appendChild(EdenCreateGameOverWindow());

    EdenGameContentElement.appendChild(screen);

    const chatInput = screen.querySelector(".eden-game-chat-input");
    if (chatFocused && chatInput instanceof HTMLInputElement) {
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }
}

// Logs a chat message from this computer and, online, broadcasts it.
function EdenSendGameChat(text) {
    text = text.trim();
    if (!text || !EdenGameState) return;
    EdenGameChatDraft = "";
    EdenAddGameChat("You", text);
    if (EdenGameState.online) EdenOnlineSendChat(text);
    EdenShowGameBoard();
}

function EdenCreateGameHandRow(side) {
    const gameState = EdenGameState;
    const row = EdenCreateElement(
        "div",
        `eden-game-hand-row eden-game-hand-row-${side}`
    );

    let index = 0;

    // The opponent's hand is face down, except for spectators, who see both hands.
    const faceUp = side === "player" || gameState.localSeat === null;
    const interactive = gameState[side].control === "local";

    for (let handIndex = 0; handIndex < gameState[side].hand.length; handIndex++) {
        const card = EdenGetCardView(gameState[side].hand[handIndex]);
        if (!card) continue;

        const cardElement = faceUp
            ? EdenCardGameRenderCard(card, { clickable: interactive })
            : EdenCardGameRenderSleeve();

        // The CSS uses these to fan out (and overlap) the hand.
        cardElement.style.setProperty("--eden-hand-index", String(index++));

        if (interactive) {
            if (handIndex === EdenSelectedHandIndex) cardElement.classList.add("eden-game-hand-card-selected");
            // Cards whose canPlay fails are faded and can't be selected.
            if (!EdenCanPlayCard(gameState[side], gameState[side].hand[handIndex])) {
                cardElement.classList.add("eden-game-hand-card-unplayable");
                EdenAttachTooltip(cardElement, "Can't play this yet", card.cannotPlayText ?? "Its condition isn't met.");
            }

            cardElement.addEventListener("click", () => {
                EdenHandleCardClick(handIndex);
            });
            cardElement.addEventListener("mousedown", event => {
                EdenStartHandDrag(event, handIndex, card);
            });
        }

        if (faceUp) {
            cardElement.addEventListener("contextmenu", event => {
                event.preventDefault();
                EdenShowCardPreview(card);
            });
        } else cardElement.addEventListener("contextmenu", event => event.preventDefault());

        row.appendChild(cardElement);
    }

    row.style.setProperty("--eden-hand-count", String(index));
    return row;
}

// Toggles the hand card's selection; it's played once a board slot is clicked.
function EdenHandleCardClick(handIndex) {
    // Ignore the click that ends a drag.
    if (Date.now() - EdenDragEndTime < 100) return;
    if (!EdenCanSelectHandCard(handIndex)) return;

    EdenSelectedHandIndex = EdenSelectedHandIndex === handIndex ? null : handIndex;
    EdenAbilitySelecting = false;
    EdenShowGameBoard();
}

function EdenCanSelectHandCard(handIndex) {
    const gameState = EdenGameState;
    if (!EdenIsLocalTurn() || gameState.actionsRemaining <= 0 || gameState.pendingSelection) return false;
    return EdenCanPlayCard(gameState.player, gameState.player.hand[handIndex]);
}

// Time the last drag ended, so its trailing click is ignored.
let EdenDragEndTime = 0;

/*
Shared drag-onto-board handling. After a small move, drag.start() selects the dragged thing (so its targets light up)
and drag.move() follows the mouse. On release over a highlighted target, that target is clicked (same path as
select + click); otherwise drag.cancel() runs.
drag: { start(), move(moveEvent), end(), isSelected(), cancel() }
*/
function EdenTrackBoardDrag(event, drag) {
    // Block the browser's image drag and text selection.
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;

    const move = moveEvent => {
        if (!dragging) {
            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
            dragging = true;
            drag.start();
            EdenGameContainer.classList.add("eden-game-dragging");
        }
        drag.move(moveEvent);
    };

    const drop = upEvent => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", drop);
        // No movement: a normal click, handled by the click listener.
        if (!dragging) return;

        drag.end();
        EdenGameContainer.classList.remove("eden-game-dragging");
        EdenDragEndTime = Date.now();
        const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".eden-game-board-slot-target, .eden-game-board-row-target");
        if (target instanceof HTMLElement && drag.isSelected()) target.click();
        else {
            drag.cancel();
            EdenShowGameBoard();
        }
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", drop);
}

// Hand card drag: a ghost copy follows the mouse.
function EdenStartHandDrag(event, handIndex, card) {
    if (event.button !== 0 || !EdenCanSelectHandCard(handIndex)) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const grabX = event.clientX - rect.left;
    const grabY = event.clientY - rect.top;
    let ghost = null;

    EdenTrackBoardDrag(event, {
        start: () => {
            EdenSelectedHandIndex = handIndex;
            EdenAbilitySelecting = false;
            EdenShowGameBoard();
            ghost = EdenCardGameRenderCard(card);
            ghost.classList.add("eden-game-drag-ghost");
            ghost.style.width = `${rect.width}px`;
            EdenGameContainer.appendChild(ghost);
        },
        move: moveEvent => {
            ghost.style.left = `${moveEvent.clientX - grabX}px`;
            ghost.style.top = `${moveEvent.clientY - grabY}px`;
        },
        end: () => ghost.remove(),
        isSelected: () => EdenSelectedHandIndex === handIndex,
        cancel: () => EdenSelectedHandIndex = null
    });
}

// Ability drag (targetSlot abilities, e.g. First Bell): an arrow stretches from the button to the mouse.
function EdenStartAbilityDrag(event) {
    if (event.button !== 0 || !EdenGetPlayerClass(EdenGameState.player)?.targetSlot) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const fromX = rect.left + rect.width / 2;
    const fromY = rect.top + rect.height / 2;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.classList.add("eden-game-drag-arrow");
    arrow.innerHTML = `
        <defs><marker id="eden-drag-arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0 L10,5 L0,10 z" /></marker></defs>
        <path class="eden-game-drag-arrow-line" marker-end="url(#eden-drag-arrow-head)" />`;

    EdenTrackBoardDrag(event, {
        start: () => {
            EdenAbilitySelecting = true;
            EdenSelectedHandIndex = null;
            EdenShowGameBoard();
            EdenGameContainer.appendChild(arrow);
        },
        move: moveEvent => {
            // Upward curve: control point is the midpoint, raised by 1/5 of the length.
            const toX = moveEvent.clientX;
            const toY = moveEvent.clientY;
            const lift = Math.hypot(toX - fromX, toY - fromY) / 5;
            arrow.querySelector("path.eden-game-drag-arrow-line")?.setAttribute("d", `M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${(fromY + toY) / 2 - lift} ${toX} ${toY}`);
        },
        end: () => arrow.remove(),
        isSelected: () => EdenAbilitySelecting,
        cancel: () => EdenAbilitySelecting = false
    });
}

// Instant abilities resolve now; targetSlot abilities toggle slot selection.
function EdenHandleAbilityClick() {
    // Ignore the click that ends a drag.
    if (Date.now() - EdenDragEndTime < 100) return;
    const cardClass = EdenGetPlayerClass(EdenGameState.player);

    if (cardClass?.targetSlot) {
        EdenAbilitySelecting = !EdenAbilitySelecting;
        EdenSelectedHandIndex = null;
    } else EdenSubmitMove(["ability", null]);

    EdenShowGameBoard();
}

// Plays the selected hand card or ability into an own board slot. boardIndex is null for an event (whole board).
function EdenHandleSlotClick(boardIndex) {
    if (EdenAbilitySelecting) EdenSubmitMove(["ability", boardIndex]);
    else if (EdenSelectedHandIndex !== null) EdenSubmitMove(["play", EdenSelectedHandIndex, boardIndex]);
    else return;

    EdenSelectedHandIndex = null;
    EdenAbilitySelecting = false;
    EdenShowGameBoard();
}

// Board targets of the selected hand card, if it's an event that picks one (not a backstage pick like Re-Run).
function EdenGetSelectedEventTargets() {
    const instance = EdenSelectedHandIndex === null ? null : EdenGameState.player.hand[EdenSelectedHandIndex];
    if (!instance || !EdenIsEventCard(EdenGetCard(instance))) return [];
    return EdenGetSelectionTargets(EdenGameState.player, instance).filter(target => target.boardIndex !== undefined);
}

// Plays the selected event and picks its target in one click (still sent as two moves: play, target).
function EdenPlayEventOnTarget(targetPlayer, boardIndex) {
    const handIndex = EdenSelectedHandIndex;
    EdenSelectedHandIndex = null;
    if (EdenSubmitMove(["play", handIndex, null])) EdenSubmitMove(["target", targetPlayer.seat, boardIndex]);
    EdenShowGameBoard();
}

function EdenCreateGameBoardRow(side) {
    const gameState = EdenGameState;
    const row = EdenCreateElement(
        "div",
        `eden-game-board-row eden-game-board-row-${side}`
    );

    // Valid targets of a pending cardSelection on this board (only for the player choosing).
    const selectionTargets = EdenIsLocalTurn() ? EdenGetPendingSelectionTargets().filter(target => target.ECPlayer === gameState[side]) : [];

    // A selected event with board targets (e.g. Vanilla Classic) is played by clicking the target.
    const eventTargets = EdenGetSelectedEventTargets().filter(target => target.ECPlayer === gameState[side]);
    // Other selected events target the whole board row.
    const selectedEvent = side === "player" && EdenSelectedHandIndex !== null && EdenIsEventCard(EdenGetCard(gameState.player.hand[EdenSelectedHandIndex]));
    if (selectedEvent && EdenGetSelectedEventTargets().length === 0) {
        row.classList.add("eden-game-board-row-target");
        row.addEventListener("click", () => {
            EdenHandleSlotClick(null);
        });
    }

    for (let i = 0; i < 4; i++) {
        const slot = EdenCreateElement("div", "eden-game-board-slot");
        const boardCard = gameState[side].board[i];

        if (boardCard) {
            // Shows this copy's modified stats (e.g. from Waitress).
            const card = EdenGetCardView(boardCard);
            if (card) {
                slot.classList.add("eden-game-board-slot-filled");
                const cardElement = EdenCardGameRenderCard(card);
                cardElement.addEventListener("contextmenu", event => {
                    event.preventDefault();
                    EdenShowCardPreview(card);
                });
                slot.appendChild(cardElement);
            }
        }

        if (selectionTargets.some(target => target.boardIndex === i)) {
            slot.classList.add("eden-game-board-slot-target", "eden-game-board-slot-select");
            slot.addEventListener("click", () => {
                if (EdenSubmitMove(["target", gameState[side].seat, i])) EdenShowGameBoard();
            });
        }
        else if (eventTargets.some(target => target.boardIndex === i)) {
            slot.classList.add("eden-game-board-slot-target", "eden-game-board-slot-select");
            slot.addEventListener("click", () => {
                EdenPlayEventOnTarget(gameState[side], i);
            });
        }
        // With a hand card or ability selected, every own slot (empty or filled) is a target.
        else if (side === "player" && !selectedEvent && (EdenSelectedHandIndex !== null || EdenAbilitySelecting)) {
            slot.classList.add("eden-game-board-slot-target");
            slot.addEventListener("click", () => {
                EdenHandleSlotClick(i);
            });
        }

        row.appendChild(slot);
    }
    return row;
}

// Panel beside a player's board: name, Fame and ability button.
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
            EdenGetPanelName(gameState[side])
        )
    );

    const fame = EdenCreateElement("div", "eden-game-player-fame");
    fame.appendChild(EdenCreateElement("div", "eden-game-player-fame-value", String(gameState[side].fame)));
    fame.appendChild(EdenCreateElement("div", "eden-game-player-fame-label", "Fame"));
    panel.appendChild(fame);

    // Disabled buttons get no mouse events, so the right-click preview listens on this wrapper.
    const abilitySlot = EdenCreateElement("div", "eden-game-ability-slot");
    const abilityButton = EdenCreateElement("button", "eden-deck-builder-button eden-game-ability-button");
    const cardClass = EdenGetPlayerClass(gameState[side]);

    // Ability image (assets/ability/{abilityName}.png), falling back to the name as text.
    if (cardClass?.abilityName) {
        const image = EdenCreateAbilityImage(cardClass, "eden-game-ability-image");
        image.addEventListener("error", () => {
            abilityButton.textContent = cardClass.abilityName;
        });
        abilityButton.appendChild(image);
    } else abilityButton.textContent = "Use Ability";

    abilitySlot.title = cardClass?.effect ? `${cardClass.abilityName}: ${cardClass.abilityDescription}` : "This class has no ability yet.";
    abilityButton.disabled = gameState[side].control !== "local" || !EdenIsLocalTurn() || !cardClass?.effect || gameState.actionsRemaining <= 0 || gameState.abilityUsed || gameState.pendingSelection !== null;
    if (side === "player" && EdenAbilitySelecting) abilityButton.classList.add("eden-game-ability-button-selected");

    abilityButton.addEventListener("click", EdenHandleAbilityClick);
    abilityButton.addEventListener("mousedown", EdenStartAbilityDrag);
    abilitySlot.addEventListener("contextmenu", event => {
        event.preventDefault();
        if (cardClass?.abilityName) EdenShowAbilityPreview(cardClass);
    });

    abilitySlot.appendChild(abilityButton);
    panel.appendChild(abilitySlot);

    return panel;
}

function EdenCreateAbilityImage(cardClass, className) {
    const image = EdenCreateElement("img", className);
    image.src = `${EdenAddonAssets}ability/${encodeURIComponent(cardClass.abilityName)}.png`;
    image.alt = cardClass.abilityName;
    image.draggable = false;
    return image;
}

// Enlarged ability preview (right-click), with keyword blocks on the left like a card preview.
function EdenShowAbilityPreview(cardClass) {
    const preview = EdenCreateElement("div", "eden-ability-preview");
    const image = EdenCreateAbilityImage(cardClass, "eden-ability-preview-image");
    image.addEventListener("error", () => {
        image.style.display = "none";
    });

    preview.appendChild(image);
    preview.appendChild(EdenCreateElement("div", "eden-ability-preview-name", cardClass.abilityName));
    const description = EdenCreateElement("div", "eden-ability-preview-effect");
    EdenAppendHighlightedText(description, cardClass.abilityDescription ?? "");
    preview.appendChild(description);
    EdenShowPreviewElement(EdenCreatePreviewWithKeywords(preview, cardClass.abilityDescription));
}

// Strip between the two boards: turn label, actions left and hints.
function EdenCreateGameCenterInfo() {
    const gameState = EdenGameState;
    const center = EdenCreateElement("div", "eden-game-center-info");
    const current = gameState[gameState.currentTurn];
    let turnLabel = current.control === "local" ? "Your Turn" : `${EdenGetPanelName(current)}'s Turn`;
    // An online player who left can return and continue; their turn waits until then.
    if (gameState.online && !gameState.gameOver && !EdenOnlineIsInRoom(current.memberNumber)) turnLabel = `Waiting for ${current.name} to reconnect`;

    center.appendChild(
        EdenCreateElement(
            "div",
            "eden-game-turn-label",
            turnLabel
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
        : EdenGetCard(gameState.player.hand[EdenSelectedHandIndex]);

    if (selectedCard) {
        center.appendChild(
            EdenCreateElement(
                "div",
                "eden-game-hint",
                EdenGetSelectedEventTargets().length > 0
                    ? `Choose a target for ${selectedCard.name} (Esc to cancel)`
                    : EdenIsEventCard(selectedCard)
                    ? `Click the board to play ${selectedCard.name} (Esc to cancel)`
                    : `Choose a slot for ${selectedCard.name} (Esc to cancel)`
            )
        );
    }

    if (EdenAbilitySelecting) {
        center.appendChild(
            EdenCreateElement(
                "div",
                "eden-game-hint",
                `Choose a slot for ${EdenGetPlayerClass(gameState.player)?.abilityName} (Esc to cancel)`
            )
        );
    }

    if (gameState.pendingSelection) {
        center.appendChild(
            EdenCreateElement(
                "div",
                "eden-game-hint",
                current.control === "local"
                    ? `Choose a target for ${EdenGetCard(gameState.pendingSelection.card)?.name}`
                    : `${EdenGetPanelName(current)} is choosing a target for ${EdenGetCard(gameState.pendingSelection.card)?.name}`
            )
        );
    }
    return center;
}

// Side panel: game log, chat input and action buttons.
function EdenCreateGameChatPanel() {
    const gameState = EdenGameState;

    const panel = EdenCreateElement("aside", "eden-game-chat-panel");

    const chatLog = EdenCreateElement("div", "eden-game-chat-log");

    // One block per turn (see EdenGameState.log), one element per action.
    for (const block of gameState.log) {
        const actions = block.actions.filter(action => action.length > 0);
        if (actions.length === 0) continue;

        const blockElement = EdenCreateElement("div", `eden-game-chat-turn eden-game-chat-turn-${block.side ?? "start"}`);
        // Turns alternate, so a side's own turn number is half the combined count, rounded up.
        const title = block.turn === 0 ? "Game Start" : `Turn ${Math.ceil(block.turn / 2)} · ${EdenGetPanelName(gameState[block.side])}`;
        blockElement.appendChild(EdenCreateElement("div", "eden-game-chat-turn-title", title));

        for (const action of actions) {
            const actionElement = EdenCreateElement("div", "eden-game-chat-action");
            for (const message of action) {
                if (typeof message === "string") {
                    actionElement.appendChild(EdenCreateElement("div", "eden-game-chat-message", message));
                    continue;
                }
                // Chat entry: { name, text }.
                actionElement.classList.add("eden-game-chat-action-chat");
                const chatElement = EdenCreateElement("div", "eden-game-chat-message");
                chatElement.appendChild(EdenCreateElement("span", "eden-game-chat-sender", `${message.name}: `));
                chatElement.appendChild(document.createTextNode(message.text));
                actionElement.appendChild(chatElement);
            }
            blockElement.appendChild(actionElement);
        }
        chatLog.appendChild(blockElement);
    }

    if (!chatLog.hasChildNodes()) chatLog.appendChild(EdenCreateElement("div", "eden-game-chat-placeholder", "Game log will appear here."));

    // Scroll to the newest messages once the panel is on the page.
    requestAnimationFrame(() => {
        chatLog.scrollTop = chatLog.scrollHeight;
    });

    const buttons = EdenCreateElement("div", "eden-game-action-buttons");

    // Online, chat goes to the other player and spectators.
    const chatInput = EdenCreateElement("input", "eden-game-chat-input");
    chatInput.type = "text";
    chatInput.placeholder = "Send a message...";
    chatInput.maxLength = EdenGameChatMaxLength;
    chatInput.value = EdenGameChatDraft;
    chatInput.addEventListener("input", () => EdenGameChatDraft = chatInput.value);
    chatInput.addEventListener("keydown", event => {
        // Keep the host game's chat and the Esc handler from reacting to typing here.
        event.stopPropagation();
        if (event.key === "Enter") EdenSendGameChat(chatInput.value);
    });

    // Draw button shows the deck: sleeve image + cards left. The tooltip is on the wrapper since disabled buttons get no mouse events.
    const drawSlot = EdenCreateElement("div", "eden-game-draw-slot");
    const drawButton = EdenCreateElement(
        "button",
        "eden-game-action-button eden-game-draw-button",
        String(gameState.player.deck.length)
    );
    drawButton.style.backgroundImage = `url("${EdenAddonAssets}edenSleeve.png")`;

    drawButton.disabled = !EdenIsLocalTurn() || gameState.pendingSelection !== null;

    drawButton.addEventListener("click", () => {
        if (EdenSubmitMove(["draw"])) EdenShowGameBoard();
    });
    drawSlot.appendChild(drawButton);
    // With a full hand, the drawn card goes straight to the Backstage.
    const handFull = gameState.player.hand.length >= EdenMaxHandSize;
    if (handFull) drawButton.classList.add("eden-game-draw-button-full");
    EdenAttachTooltip(drawSlot, "Draw a card", handFull ? `Your hand is full (${EdenMaxHandSize} cards), so the drawn card will be sent to the Backstage.` : "");

    const passButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Pass"
    );

    passButton.disabled = !EdenIsLocalTurn() || gameState.pendingSelection !== null;

    passButton.addEventListener("click", () => {
        EdenSelectedHandIndex = null;
        if (EdenSubmitMove(["pass"])) EdenShowGameBoard();
    });

    const restingRoomButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Backstage"
    );

    restingRoomButton.addEventListener("click", () => {
        EdenRestingRoomOpen = true;
        EdenShowGameBoard();
    });

    // A running online game keeps going when closed, so this only hides the window.
    const exitButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button eden-game-exit-button",
        gameState.online && !gameState.gameOver ? "Back to Room" : "Exit Game"
    );

    exitButton.addEventListener("click", EdenCloseCardGame);

    buttons.appendChild(chatInput);
    buttons.appendChild(drawSlot);
    buttons.appendChild(passButton);
    buttons.appendChild(restingRoomButton);
    buttons.appendChild(exitButton);

    panel.appendChild(chatLog);
    panel.appendChild(buttons);

    return panel;
}

// Game-over pop-up; it covers the board so nothing else can be clicked.
function EdenCreateGameOverWindow() {
    const gameState = EdenGameState;
    const winner = gameState.winner;
    const playerWon = winner.control === "local";
    // Spectators get the winner's name instead of win/lose.
    const title = playerWon ? "You Win!" : gameState.localSeat !== null ? "You Lose" : `${winner.name} Wins!`;

    const overlay = EdenCreateElement("div", "eden-game-over-overlay");
    const popup = EdenCreateElement("div", `eden-game-over-window eden-game-over-${playerWon || gameState.localSeat === null ? "win" : "loss"}`);

    popup.appendChild(EdenCreateElement("div", "eden-game-over-title", title));
    popup.appendChild(EdenCreateElement(
        "div",
        "eden-game-over-message",
        `${EdenWho(winner)} reached ${EdenWinningFame} Fame.`
    ));

    const closeButton = EdenCreateElement("button", "eden-deck-builder-button eden-game-over-button", "Close Game");
    closeButton.addEventListener("click", EdenCloseCardGame);
    popup.appendChild(closeButton);

    overlay.appendChild(popup);
    return overlay;
}

// Whether the local player must pick a Backstage card (e.g. for Re-Run).
function EdenIsPickingBackstage() {
    return EdenIsLocalTurn() && EdenGetPendingSelectionTargets().some(target => target.backstageIndex !== undefined);
}

// Backstage window (restingRoom in the state). During a backstage pick it opens by itself and can't be closed.
function EdenCreateRestingRoomWindow() {
    const overlay = EdenCreateElement("div", "eden-game-resting-room-overlay");
    const roomWindow = EdenCreateElement("div", "eden-game-resting-room-window");
    const picking = EdenIsPickingBackstage();
    const pickable = picking ? EdenGetPendingSelectionTargets().map(target => target.backstageIndex) : [];

    roomWindow.appendChild(EdenCreateElement(
        "h2",
        "eden-game-resting-room-title",
        picking ? `Choose a card for ${EdenGetCard(EdenGameState.pendingSelection.card)?.name}` : "Backstage"
    ));

    const cardList = EdenCreateElement("div", "eden-game-resting-room-cards");

    EdenGameState.player.restingRoom.forEach((instance, backstageIndex) => {
        const card = EdenGetCardView(instance);
        if (!card) return;

        const cardElement = EdenCardGameRenderCard(card);
        cardElement.addEventListener("contextmenu", event => {
            event.preventDefault();
            EdenShowCardPreview(card);
        });
        if (pickable.includes(backstageIndex)) {
            cardElement.classList.add("eden-game-resting-room-pick");
            cardElement.addEventListener("click", () => {
                if (EdenSubmitMove(["backstage", backstageIndex])) EdenShowGameBoard();
            });
        }
        // While picking, only pickable cards are shown.
        else if (picking) return;
        cardList.appendChild(cardElement);
    });

    if (!cardList.hasChildNodes()) cardList.appendChild(EdenCreateElement("div", "eden-game-resting-room-empty", "Your Backstage is empty."));

    const closeButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-game-action-button",
        "Close"
    );

    closeButton.addEventListener("click", () => {
        EdenRestingRoomOpen = false;
        EdenShowGameBoard();
    });

    roomWindow.appendChild(cardList);
    if (!picking) roomWindow.appendChild(closeButton);
    overlay.appendChild(roomWindow);
    return overlay;
}

document.addEventListener("DOMContentLoaded", EdenInitializeGame);
