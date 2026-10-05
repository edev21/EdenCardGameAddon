const EdenDeckSize = 30;
const EdenMaxCopies = 2;

let EdenDeckBuilderContainer = null;
let EdenDeckBuilderContentElement = null;
let EdenCardPreviewOverlay = null;
let EdenOpenButtonElement = null;
let EdenCurrentDeck = null;
let EdenCurrentScreen = "deck-list";

const EdenDefaultDeck = {
  "id": "Default Deck",
  "name": "Default Deck",
  "class": "shibari",
  "cards": [ 1, 1, 2, 2, 3, 3, 8, 1, 2, 2, 3, 3, 8, 1, 2, 2, 3, 3, 8, 1, 2, 2, 3, 3, 8 ]
}

/*
    Re-finds (or (re)creates) the container and its inner content wrapper.

    This is self-healing on purpose: if the host page re-renders and
    replaces/removes #eden-card-game-deck-builder, calling open()/close() again
    will not silently operate on a detached element or throw.
*/
function EdenEnsureDeckBuilderContainer() {
    let container = document.getElementById("eden-card-game-deck-builder");

    if (!container) {
        container = document.createElement("div");
        container.id = "eden-card-game-deck-builder";
        document.body.appendChild(container);
    }

    EdenDeckBuilderContainer = container;

    EdenDeckBuilderContentElement = container.querySelector(".eden-deck-builder-content");

    if (!EdenDeckBuilderContentElement) {
        container.innerHTML = "";

        const closeButton = EdenCreateElement(
            "button",
            "eden-deck-builder-close-button",
            "×"
        );
        closeButton.title = "Close";
        closeButton.setAttribute("aria-label", "Close deck builder");

        closeButton.addEventListener("click", EdenCloseCardGameDeckBuilder);

        EdenDeckBuilderContentElement = EdenCreateElement("div", "eden-deck-builder-content");

        container.appendChild(closeButton);
        container.appendChild(EdenDeckBuilderContentElement);
    }

    return EdenDeckBuilderContainer;
}

/*
    The preview lives on the page body, not inside the deck builder, so the
    game screen can use it too.
*/
function EdenEnsureCardPreviewOverlay() {
    let overlay = document.getElementById("eden-card-preview-overlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "eden-card-preview-overlay";
        overlay.className = "eden-card-preview-overlay";
        overlay.addEventListener("click", EdenHideCardPreview);
        overlay.addEventListener("contextmenu", event => {
            event.preventDefault();
            EdenHideCardPreview();
        });
        document.body.appendChild(overlay);
    }

    EdenCardPreviewOverlay = overlay;
    return EdenCardPreviewOverlay;
}

/*
    Shown on right-click. Right-clicking again, or clicking anywhere,
    closes it (see the overlay's own listeners above).
*/
function EdenShowCardPreview(card) {
    EdenShowPreviewElement(EdenCardGameRenderCard(card));
}

// Shows any element (a card, an ability) in the preview overlay.
function EdenShowPreviewElement(element) {
    EdenEnsureCardPreviewOverlay();
    EdenCardPreviewOverlay.innerHTML = "";
    EdenCardPreviewOverlay.appendChild(element);
    EdenCardPreviewOverlay.classList.add("eden-card-preview-visible");
}

function EdenHideCardPreview() {
    if (!EdenCardPreviewOverlay) return;

    EdenCardPreviewOverlay.classList.remove("eden-card-preview-visible");
    EdenCardPreviewOverlay.innerHTML = "";
}

/*
    Re-finds (or creates) the standalone bottom-left button used to open
    the deck builder. Lives outside #eden-card-game-deck-builder so it stays
    visible while the deck builder itself is closed/hidden.
*/
function EdenEnsureOpenButton() {
    let button = document.getElementById("eden-open-deck-builder-button");

    if (!button) {
        button = document.createElement("button");
        button.id = "eden-open-deck-builder-button";
        button.className = "eden-open-deck-builder-button";
        button.textContent = "Open Deck Builder";
        button.addEventListener("click", EdenOpenCardGameDeckBuilder);
        document.body.appendChild(button);
    }

    EdenOpenButtonElement = button;
    return EdenOpenButtonElement;
}

/*
    Call this whenever you need to show/hide the open button yourself,
    e.g. while your own game UI is covering the screen.
*/
function EdenShowOpenButton() {
    EdenEnsureOpenButton().classList.remove("eden-open-deck-builder-button-hidden");
}

function EdenHideOpenButton() {
    EdenEnsureOpenButton().classList.add("eden-open-deck-builder-button-hidden");
}

function EdenInitializeDeckBuilder() {
    EdenEnsureDeckBuilderContainer();
    EdenShowOpenButton();
    EdenShowDeckList();
}

/*
    This is the function you will call from your own button.

    Example from your existing game:
        EdenOpenCardGameDeckBuilder();
*/
function EdenOpenCardGameDeckBuilder() {
    EdenEnsureDeckBuilderContainer();

    document.documentElement.classList.add("eden-card-game-deck-builder-open");
    EdenDeckBuilderContainer.classList.add("eden-card-game-deck-builder-visible");

    EdenHideOpenButton();
    EdenShowDeckList();
}

/*
    Use this from your own Back/Close button if you want the
    deck builder to disappear.

    You can replace this later with the game's own screen system.
*/
function EdenCloseCardGameDeckBuilder() {
    document.documentElement.classList.remove("eden-card-game-deck-builder-open");

    EdenShowOpenButton();

    if (!EdenDeckBuilderContainer) return;

    EdenDeckBuilderContainer.classList.remove("eden-card-game-deck-builder-visible");

    EdenCurrentDeck = null;
    EdenCurrentScreen = "deck-list";
}

function EdenClearBuilder() {
    EdenDeckBuilderContentElement.innerHTML = "";
}

function EdenShowDeckList() {
    EdenCurrentScreen = "deck-list";
    EdenCurrentDeck = null;

    EdenClearBuilder();

    const screen = EdenCreateElement("div", "eden-deck-builder-screen");

    const title = EdenCreateElement("h1", "eden-deck-builder-title", "My Decks");

    const deckList = EdenCreateElement("div", "eden-deck-list");

    const decks = EdenGetDecks();

    if (decks.length === 0) {
        const emptyMessage = EdenCreateElement(
            "div",
            "eden-deck-list-empty",
            "You do not have any decks yet."
        );

        deckList.appendChild(emptyMessage);
    } else {
        for (const deck of decks) deckList.appendChild(EdenCreateDeckListItem(deck));
    }

    const createButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-create-button",
        "Create New Deck"
    );

    createButton.addEventListener("click", () => {
        const deck = EdenCreateDeck();
        EdenCurrentDeck = deck;
        EdenShowClassSelect();
    });

    screen.appendChild(title);
    screen.appendChild(deckList);
    screen.appendChild(createButton);

    EdenDeckBuilderContentElement.appendChild(screen);
}

function EdenCreateDeckListItem(deck) {
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
        EdenCurrentDeck = EdenGetDeckById(deck.id);
        EdenShowDeckEditor();
    });

    return item;
}

function EdenShowClassSelect() {
    EdenCurrentScreen = "class-select";

    EdenClearBuilder();

    const screen = EdenCreateElement("div", "eden-deck-builder-screen");

    const title = EdenCreateElement(
        "h1",
        "eden-deck-builder-title",
        "Choose Class"
    );

    const classList = EdenCreateElement("div", "eden-class-list");

    for (const cardClass of EdenCardClasses) {
        const button = EdenCreateElement(
            "button",
            "eden-class-select-button"
        );

        const className = EdenCreateElement(
            "div",
            "eden-class-select-name",
            cardClass.name
        );

        button.appendChild(className);

        button.addEventListener("click", () => {
            EdenCurrentDeck.class = cardClass.id;
            EdenUpdateDeck(EdenCurrentDeck);
            EdenShowDeckEditor();
        });

        classList.appendChild(button);
    }

    const backButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-secondary-button",
        "Back"
    );

    backButton.addEventListener("click", () => {
        EdenDeleteDeck(EdenCurrentDeck.id);
        EdenShowDeckList();
    });

    screen.appendChild(title);
    screen.appendChild(classList);
    screen.appendChild(backButton);

    EdenDeckBuilderContentElement.appendChild(screen);
}

function EdenShowDeckEditor() {
    EdenCurrentScreen = "deck-editor";

    EdenCurrentDeck = EdenGetDeckById(EdenCurrentDeck.id);

    if (!EdenCurrentDeck) {
        EdenShowDeckList();
        return;
    }

    EdenClearBuilder();

    const screen = EdenCreateElement("div", "eden-deck-editor-screen");

    const topBar = EdenCreateDeckEditorTopBar();
    const editorBody = EdenCreateElement("div", "eden-deck-editor-body");

    const cardArea = EdenCreateElement("div", "eden-available-cards-area");
    const deckArea = EdenCreateElement("aside", "eden-current-deck-area");

    EdenRenderAvailableCards(cardArea);
    EdenRenderCurrentDeck(deckArea);

    editorBody.appendChild(cardArea);
    editorBody.appendChild(deckArea);

    screen.appendChild(topBar);
    screen.appendChild(editorBody);

    EdenDeckBuilderContentElement.appendChild(screen);
}

function EdenCreateDeckEditorTopBar() {
    const topBar = EdenCreateElement("div", "eden-deck-editor-top-bar");

    const leftSide = EdenCreateElement("div", "eden-deck-editor-top-left");

    const backButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button",
        "Back"
    );

    backButton.addEventListener("click", () => {
        EdenUpdateDeck(EdenCurrentDeck);
        EdenShowDeckList();
    });

    const renameButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button",
        "Rename"
    );

    renameButton.addEventListener("click", EdenRenameCurrentDeck);

    leftSide.appendChild(backButton);
    leftSide.appendChild(renameButton);

    const titleArea = EdenCreateElement("div", "eden-deck-editor-title-area");

    const title = EdenCreateElement(
        "div",
        "eden-deck-editor-title",
        EdenCurrentDeck.name
    );

    const className = EdenCreateElement(
        "div",
        "eden-deck-editor-class",
        EdenGetClassName(EdenCurrentDeck.class)
    );

    titleArea.appendChild(title);
    titleArea.appendChild(className);

    const rightSide = EdenCreateElement("div", "eden-deck-editor-top-right");

    const cardCount = EdenCreateElement(
        "div",
        "eden-deck-editor-card-count"
    );

    EdenUpdateCardCountElement(cardCount);

    rightSide.appendChild(cardCount);

    topBar.appendChild(leftSide);
    topBar.appendChild(titleArea);
    topBar.appendChild(rightSide);

    return topBar;
}

function EdenRenderAvailableCards(container) {
    const heading = EdenCreateElement(
        "div",
        "eden-deck-editor-section-title",
        "Cards"
    );

    const cardGrid = EdenCreateElement("div", "eden-available-card-grid");

    const availableCards = EdenGetCardsForClass(EdenCurrentDeck.class);

    for (const card of availableCards) {
        const cardElement = EdenCardGameRenderCard(card, {
            clickable: true
        });

        const count = EdenGetCardCount(EdenCurrentDeck, card.id);

        if (count >= EdenMaxCopies) cardElement.classList.add("eden-card-game-card-disabled");

        cardElement.addEventListener("click", () => {
            EdenAddCardToDeck(card.id);
        });

        cardElement.addEventListener("contextmenu", event => {
            event.preventDefault();
            EdenShowCardPreview(card);
        });

        cardGrid.appendChild(cardElement);
    }

    container.appendChild(heading);
    container.appendChild(cardGrid);
}

function EdenRenderCurrentDeck(container) {
    const heading = EdenCreateElement(
        "div",
        "eden-deck-editor-section-title",
        "Your Deck"
    );

    const deckList = EdenCreateElement("div", "eden-current-deck-list");

    const cardCounts = EdenGetDeckCardCounts(EdenCurrentDeck);

    if (cardCounts.length === 0) {
        const emptyMessage = EdenCreateElement(
            "div",
            "eden-current-deck-empty",
            "Your deck is empty."
        );

        deckList.appendChild(emptyMessage);
    } else {
        for (const entry of cardCounts) {
            const card = EdenGetCardById(entry.cardId);

            if (!card) continue;

            const item = EdenCreateElement("button", "eden-current-deck-list-item");
            item.title = "Click to remove one copy";

            const name = EdenCreateElement("div", "eden-current-deck-list-item-name", card.name);
            const count = EdenCreateElement("div", "eden-current-deck-list-item-count", `x${entry.count}`);

            item.appendChild(name);
            item.appendChild(count);

            item.addEventListener("click", () => {
                EdenRemoveCardFromDeck(card.id);
            });

            item.addEventListener("contextmenu", event => {
                event.preventDefault();
                EdenShowCardPreview(card);
            });

            deckList.appendChild(item);
        }
    }

    container.appendChild(heading);
    container.appendChild(deckList);
}

function EdenAddCardToDeck(cardId) {
    if (EdenGetTotalCards(EdenCurrentDeck) >= EdenDeckSize) return;

    if (EdenGetCardCount(EdenCurrentDeck, cardId) >= EdenMaxCopies) return;

    EdenCurrentDeck.cards.push(cardId);
    EdenUpdateDeck(EdenCurrentDeck);
    EdenShowDeckEditor();
}

function EdenRemoveCardFromDeck(cardId) {
    const cardIndex = EdenCurrentDeck.cards.lastIndexOf(cardId);

    if (cardIndex === -1) return;

    EdenCurrentDeck.cards.splice(cardIndex, 1);
    EdenUpdateDeck(EdenCurrentDeck);
    EdenShowDeckEditor();
}

function EdenRenameCurrentDeck() {
    const newName = window.prompt(
        "Enter a name for this deck:",
        EdenCurrentDeck.name
    );

    if (newName === null) return;

    const trimmedName = newName.trim();

    if (trimmedName === "") return;

    EdenCurrentDeck.name = trimmedName;
    EdenUpdateDeck(EdenCurrentDeck);
    EdenShowDeckEditor();
}

function EdenGetCardCount(deck, cardId) {
    return deck.cards.filter(id => id === cardId).length;
}

function EdenGetTotalCards(deck) {
    return deck.cards.length;
}

function EdenGetDeckCardCounts(deck) {
    const counts = [];

    for (const cardId of deck.cards) {
        const existing = counts.find(entry => entry.cardId === cardId);

        if (existing) {
            existing.count++;
        } else {
            counts.push({
                cardId,
                count: 1
            });
        }
    }

    return counts;
}

function EdenGetClassName(classId) {
    const cardClass = EdenCardClasses.find(item => item.id === classId);

    if (!cardClass) return "No Class";

    return cardClass.name;
}

function EdenUpdateCardCountElement(element) {
    const count = EdenGetTotalCards(EdenCurrentDeck);

    element.textContent = `${count}/${EdenDeckSize} cards`;

    if (count === EdenDeckSize) {
        element.classList.add("eden-deck-builder-count-complete");
    } else {
        element.classList.remove("eden-deck-builder-count-complete");
    }
}

function EdenCreateElement(tagName, className, text = "") {
    const element = document.createElement(tagName);

    if (className) element.className = className;

    if (text !== "") element.textContent = text;

    return element;
}

document.addEventListener("DOMContentLoaded", EdenInitializeDeckBuilder);
