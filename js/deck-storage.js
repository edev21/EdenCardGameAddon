const EdenDeckStorageKey = "edenCardGameDecks";

function EdenGetDecks() {
    try {
        const savedDecks = localStorage.getItem(EdenDeckStorageKey);

        if (!savedDecks) return [];

        const decks = JSON.parse(savedDecks);
        return Array.isArray(decks) ? decks : [];
    } catch (error) {
        console.error("Could not load decks from Local Storage.", error);
        return [];
    }
}

function EdenSaveDecks(decks) {
    localStorage.setItem(EdenDeckStorageKey, JSON.stringify(decks));
}

function EdenGetDeckById(deckId) {
    return EdenGetDecks().find(deck => deck.id === deckId);
}

function EdenCreateDeck() {
    const decks = EdenGetDecks();

    const deck = {
        id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: "New Deck",
        class: null,
        cards: []
    };

    decks.push(deck);
    EdenSaveDecks(decks);

    return deck;
}

function EdenUpdateDeck(updatedDeck) {
    const decks = EdenGetDecks();
    const deckIndex = decks.findIndex(deck => deck.id === updatedDeck.id);

    if (deckIndex === -1) return;

    decks[deckIndex] = updatedDeck;
    EdenSaveDecks(decks);
}

function EdenDeleteDeck(deckId) {
    const decks = EdenGetDecks().filter(deck => deck.id !== deckId);
    EdenSaveDecks(decks);
}
