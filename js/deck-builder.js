const EdenDeckSize = 30;
const EdenMaxCopies = 2;

let EdenDeckBuilderContainer = null;
let EdenDeckBuilderContentElement = null;
let EdenCardPreviewOverlay = null;
let EdenOpenButtonElement = null;
let EdenCurrentDeck = null;
let EdenCurrentScreen = "deck-list";
let EdenDeckSearchText = "";
// Card list sort: key is "entryFame", "exitFame" or null (database order); direction is "desc" or "asc".
let EdenDeckSort = { key: null, direction: "desc" };
// Which cards the editor lists: "class" (the deck's class cards) or "general".
let EdenDeckTab = "class";

// The AI's deck in local games.
const EdenDefaultDeck = {
  "id": "Default Deck",
  "name": "Default Deck",
  "class": "college",
  "cards": [ 1000, 1000, 1001, 1001, 1002, 1002, 1003, 1003, 1004, 1004, 1005, 1005, 1006, 1006, 1007, 1007, 1008, 1008, 1009, 1009, 1011, 1011, 1012, 1012, 1013, 1013, 7, 8, 10, 12 ]
}

// Finds or recreates the container and content wrapper, in case the host page removed them.
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

// The preview overlay lives on body (not in the deck builder) so the game screen uses it too.
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

// Right-click preview with keyword blocks. Any click on the overlay closes it.
function EdenShowCardPreview(card) {
    EdenShowPreviewElement(EdenCreatePreviewWithKeywords(EdenCardGameRenderCard(card, { statTooltips: true }), card.effect));
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

// Floating "Open Deck Builder" button, outside the builder container so it shows while it's closed. Hidden in the host game by CSS.
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

// Entry point, used by the room's Build button and the dealer's dialog.
function EdenOpenCardGameDeckBuilder() {
    EdenEnsureDeckBuilderContainer();

    document.documentElement.classList.add("eden-card-game-deck-builder-open");
    EdenDeckBuilderContainer.classList.add("eden-card-game-deck-builder-visible");

    EdenHideOpenButton();
    EdenShowDeckList();
}

// Closing drops any unsaved edits.
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
    EdenDeckSearchText = "";
    EdenDeckSort = { key: null, direction: "desc" };
    EdenDeckTab = "class";

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

/*
EdenCurrentDeck is a separate copy (parsed from storage); changes are only stored on Save, so Cancel/close discards them.
keepScroll keeps both lists' scroll positions (e.g. after adding or removing a card).
*/
function EdenShowDeckEditor(keepScroll = false) {
    EdenCurrentScreen = "deck-editor";

    if (!EdenCurrentDeck) {
        EdenShowDeckList();
        return;
    }

    const oldCardArea = EdenDeckBuilderContentElement.querySelector(".eden-available-cards-area");
    const oldDeckArea = EdenDeckBuilderContentElement.querySelector(".eden-current-deck-area");
    const cardScroll = keepScroll ? oldCardArea?.scrollTop ?? 0 : 0;
    const deckScroll = keepScroll ? oldDeckArea?.scrollTop ?? 0 : 0;

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
    screen.appendChild(EdenCreateDeckSearchBar(cardArea));
    screen.appendChild(editorBody);

    EdenDeckBuilderContentElement.appendChild(screen);
    // Set after the lists are on the page, so they have their full height.
    cardArea.scrollTop = cardScroll;
    deckArea.scrollTop = deckScroll;
}

function EdenCreateDeckEditorTopBar() {
    const topBar = EdenCreateElement("div", "eden-deck-editor-top-bar");

    const leftSide = EdenCreateElement("div", "eden-deck-editor-top-left");

    const saveButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button",
        "Save"
    );

    saveButton.addEventListener("click", () => {
        EdenUpdateDeck(EdenCurrentDeck);
        EdenShowDeckList();
    });

    // Just drops the edited copy; storage was never changed.
    const cancelButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button",
        "Cancel"
    );

    cancelButton.addEventListener("click", EdenShowDeckList);

    const renameButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button",
        "Rename"
    );

    renameButton.addEventListener("click", EdenRenameCurrentDeck);

    const deleteButton = EdenCreateElement(
        "button",
        "eden-deck-builder-button eden-deck-builder-small-button eden-deck-builder-danger-button",
        "Delete Deck"
    );

    deleteButton.addEventListener("click", () => {
        if (!window.confirm(`Delete "${EdenCurrentDeck.name}"? This cannot be undone.`)) return;
        EdenDeleteDeck(EdenCurrentDeck.id);
        EdenShowDeckList();
    });

    leftSide.appendChild(saveButton);
    leftSide.appendChild(cancelButton);
    leftSide.appendChild(renameButton);
    leftSide.appendChild(deleteButton);

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

/*
Bar above the card list: class/general tabs, search box and sort buttons.
Typing only redraws the card list (so the box keeps focus); the buttons redraw the whole editor.
*/
function EdenCreateDeckSearchBar(cardArea) {
    const searchBar = EdenCreateElement("div", "eden-deck-editor-search-bar");
    const input = EdenCreateElement("input", "eden-deck-editor-search-input");
    input.type = "search";
    input.placeholder = "Search name, group or effect...";
    input.value = EdenDeckSearchText;

    input.addEventListener("input", () => {
        EdenDeckSearchText = input.value;
        cardArea.innerHTML = "";
        EdenRenderAvailableCards(cardArea);
    });

    const tabs = EdenCreateElement("div", "eden-deck-editor-tabs");
    tabs.appendChild(EdenCreateDeckTab("class", EdenGetClassName(EdenCurrentDeck.class)));
    tabs.appendChild(EdenCreateDeckTab("general", "General"));

    searchBar.appendChild(tabs);
    searchBar.appendChild(input);
    searchBar.appendChild(EdenCreateDeckSortButton("entryFame", "Entry Fame"));
    searchBar.appendChild(EdenCreateDeckSortButton("exitFame", "Exit Fame"));

    return searchBar;
}

// Clicks cycle: high to low, low to high, normal order.
function EdenCreateDeckSortButton(key, label) {
    const active = EdenDeckSort.key === key;
    const arrow = !active ? "" : EdenDeckSort.direction === "desc" ? " ▼" : " ▲";
    const button = EdenCreateElement("button", "eden-deck-editor-toolbar-button", label + arrow);
    if (active) button.classList.add("eden-deck-editor-toolbar-button-active");
    button.title = !active ? "Sort high to low" : EdenDeckSort.direction === "desc" ? "Sort low to high" : "Reset sorting";

    button.addEventListener("click", () => {
        if (!active) EdenDeckSort = { key, direction: "desc" };
        else if (EdenDeckSort.direction === "desc") EdenDeckSort = { key, direction: "asc" };
        else EdenDeckSort = { key: null, direction: "desc" };
        EdenShowDeckEditor();
    });
    return button;
}

function EdenCreateDeckTab(tab, label) {
    const button = EdenCreateElement("button", "eden-deck-editor-tab", label);
    if (EdenDeckTab === tab) button.classList.add("eden-deck-editor-tab-active");
    button.addEventListener("click", () => {
        EdenDeckTab = tab;
        EdenShowDeckEditor();
    });
    return button;
}

// Editor cards: current tab, filtered by search, sorted (a missing stat counts as 0).
function EdenGetDeckEditorCards() {
    const cards = EdenGetCardsForClass(EdenCurrentDeck.class)
        .filter(card => (EdenDeckTab === "general") === (card.class === "general"))
        .filter(card => EdenCardMatchesSearch(card, EdenDeckSearchText));

    const key = EdenDeckSort.key;
    if (!key) return cards;
    const direction = EdenDeckSort.direction === "desc" ? -1 : 1;
    return cards.sort((a, b) => ((a[key] ?? 0) - (b[key] ?? 0)) * direction);
}

// Case-insensitive match on name, groups or effect.
function EdenCardMatchesSearch(card, searchText) {
    const search = searchText.trim().toLowerCase();
    if (search === "") return true;
    return [card.name, ...(card.groups ?? []), card.effect ?? ""].some(text => text.toLowerCase().includes(search));
}

function EdenRenderAvailableCards(container) {
    const heading = EdenCreateElement(
        "div",
        "eden-deck-editor-section-title",
        "Cards"
    );

    const cardGrid = EdenCreateElement("div", "eden-available-card-grid");

    const availableCards = EdenGetDeckEditorCards();

    if (availableCards.length === 0) cardGrid.appendChild(EdenCreateElement("div", "eden-available-cards-empty", EdenDeckSearchText.trim() ? "No cards match your search." : "No cards here."));

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
    EdenShowDeckEditor(true);
}

function EdenRemoveCardFromDeck(cardId) {
    const cardIndex = EdenCurrentDeck.cards.lastIndexOf(cardId);

    if (cardIndex === -1) return;

    EdenCurrentDeck.cards.splice(cardIndex, 1);
    EdenShowDeckEditor(true);
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
    EdenShowDeckEditor(true);
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
