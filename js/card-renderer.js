/*
    Reusable card renderer.

    This is intentionally global, rather than exported from an ES module,
    so it can be used from any normal script loaded by the page.

    Usage:
        const cardElement = EdenCardGameRenderCard(card);
        someContainer.appendChild(cardElement);

    The same function can later be used by:
        - the deck builder
        - the player's hand
        - the Club
        - card previews
        - rewards
        - the opponent's cards
*/

const EdenCardImageFolder = "Screens/MiniGame/ClubCard/";

function EdenCardGameRenderCard(card, options = {}) {
    const cardElement = document.createElement("div");

    cardElement.className = "eden-card-game-card";
    cardElement.dataset.cardId = card.id;

    if (options.clickable) cardElement.classList.add("eden-card-game-card-clickable");

    const name = document.createElement("div");
    name.className = "eden-card-game-card-name";
    name.textContent = card.name;
    // Full name still readable on hover if the single line truncates it.
    name.title = card.name;

    const imageArea = document.createElement("div");
    imageArea.className = "eden-card-game-card-image-area";

    const fameBadges = document.createElement("div");
    fameBadges.className = "eden-card-game-card-fame-badges";

    if (typeof card.enterFame === "number") {
        const enterFame = document.createElement("div");
        enterFame.className = "eden-card-game-card-enter-fame";
        enterFame.title = "Enter Fame";
        enterFame.textContent = card.enterFame;
        fameBadges.appendChild(enterFame);
    }

    if (typeof card.leaveFame === "number") {
        const leaveFame = document.createElement("div");
        leaveFame.className = "eden-card-game-card-leave-fame";
        leaveFame.title = "Leave Fame";
        leaveFame.textContent = card.leaveFame;
        fameBadges.appendChild(leaveFame);
    }

    const image = document.createElement("img");
    image.className = "eden-card-game-card-image";
    // Images live in the host browser game, one folder per card type.
    image.src = `${EdenCardImageFolder}${card.type}/${card.name}.png`;
    image.alt = card.name;
    image.draggable = false;

    image.addEventListener("error", () => {
        image.style.display = "none";
        cardElement.classList.add("eden-card-game-card-no-image");
    });

    imageArea.appendChild(image);
    imageArea.appendChild(fameBadges);

    const textOverlay = document.createElement("div");
    textOverlay.className = "eden-card-game-card-text-overlay";

    if (card.groups && card.groups.length > 0) {
        const groups = document.createElement("div");
        groups.className = "eden-card-game-card-groups";
        groups.textContent = card.groups.join(", ");
        textOverlay.appendChild(groups);
    }

    if (card.effect) {
        const effect = document.createElement("div");
        effect.className = "eden-card-game-card-effect";
        effect.textContent = card.effect;
        textOverlay.appendChild(effect);
    }

    cardElement.appendChild(name);
    cardElement.appendChild(imageArea);
    cardElement.appendChild(textOverlay);

    return cardElement;
}
