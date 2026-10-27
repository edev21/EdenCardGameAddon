// Card rendering, keyword highlighting and tooltips. Plain globals (no ES modules), like every addon script.

const EdenCardImageFolder = "Screens/MiniGame/ClubCard/";

/*
Keywords (EdenKeywords in cards.js)
*/

// Every keyword spelling, longest first, so a longer form wins when two overlap.
function EdenGetKeywordForms() {
    return EdenKeywords
        .flatMap(keyword => (keyword.forms ?? [keyword.name]).map(form => ({ form, keyword })))
        .sort((a, b) => b.form.length - a.form.length);
}

// Letters and digits count as part of a word, so a form never matches inside a longer word.
function EdenIsWordCharacter(character) {
    return character !== undefined && /[A-Za-z0-9]/.test(character);
}

/*
Splits text into parts: { text, keyword } for keyword matches (exact capitals, whole words) and { text, keyword: null } for the rest.
*/
function EdenSplitKeywords(text) {
    const forms = EdenGetKeywordForms();
    const parts = [];
    let plain = "";

    for (let i = 0; i < text.length;) {
        const match = forms.find(({ form }) => text.startsWith(form, i) && !EdenIsWordCharacter(text[i - 1]) && !EdenIsWordCharacter(text[i + form.length]));
        if (!match) {
            plain += text[i++];
            continue;
        }
        if (plain) parts.push({ text: plain, keyword: null });
        plain = "";
        parts.push({ text: match.form, keyword: match.keyword });
        i += match.form.length;
    }
    if (plain) parts.push({ text: plain, keyword: null });
    return parts;
}

// Appends text to an element, with every keyword in bold.
function EdenAppendHighlightedText(element, text) {
    for (const part of EdenSplitKeywords(text)) {
        if (!part.keyword) {
            element.appendChild(document.createTextNode(part.text));
            continue;
        }
        const keyword = document.createElement("strong");
        keyword.className = "eden-keyword";
        keyword.textContent = part.text;
        element.appendChild(keyword);
    }
}

// Column of explanation blocks for a text's keywords that have text (once each, in order), or null if none.
function EdenCreateKeywordBlocks(text) {
    const keywords = [];
    for (const part of EdenSplitKeywords(text ?? "")) {
        if (part.keyword?.text && !keywords.includes(part.keyword)) keywords.push(part.keyword);
    }
    if (keywords.length === 0) return null;

    const column = document.createElement("div");
    column.className = "eden-keyword-blocks";
    for (const keyword of keywords) {
        const block = document.createElement("div");
        block.className = "eden-keyword-block";
        const title = document.createElement("div");
        title.className = "eden-keyword-block-title";
        // "Arrival:" reads better as "Arrival" in a heading.
        title.textContent = keyword.name.replace(/:$/, "");
        block.appendChild(title);
        block.appendChild(document.createTextNode(keyword.text));
        column.appendChild(block);
    }
    return column;
}

// Puts keyword blocks to the left of a big preview (card or ability), if its text has any.
function EdenCreatePreviewWithKeywords(element, text) {
    const blocks = EdenCreateKeywordBlocks(text);
    if (!blocks) return element;
    const row = document.createElement("div");
    row.className = "eden-preview-row";
    row.appendChild(blocks);
    row.appendChild(element);
    return row;
}

// Fame badge tooltips (exitFame is shown as "Exit Fame").
const EdenCardStatTooltips = {
    entryFame: { title: "Entry Fame", text: "Fame you receive when this card enters your club." },
    exitFame: { title: "Exit Fame", text: "Fame you receive when this card leaves your club." }
};

// One shared tooltip on body that follows the mouse (cards have overflow: hidden, which would clip it).
let EdenTooltipElement = null;
// Element the tooltip belongs to. Redraws remove it without a mouseleave, so this is checked on mousemove.
let EdenTooltipTarget = null;

function EdenAttachTooltip(element, title, text) {
    element.addEventListener("mouseenter", event => {
        EdenTooltipTarget = element;
        EdenShowTooltip(title, text, event);
    });
    element.addEventListener("mousemove", EdenMoveTooltip);
    element.addEventListener("mouseleave", EdenHideTooltip);
}

function EdenShowTooltip(title, text, event) {
    if (!EdenTooltipElement) {
        EdenTooltipElement = document.createElement("div");
        EdenTooltipElement.id = "eden-tooltip";
        document.body.appendChild(EdenTooltipElement);
        // Any click may redraw the screen, and a removed target never sends mouseleave.
        document.addEventListener("mousedown", EdenHideTooltip, true);
        document.addEventListener("mousemove", () => {
            if (EdenTooltipTarget && !EdenTooltipTarget.isConnected) EdenHideTooltip();
        });
    }
    EdenTooltipElement.innerHTML = "";
    const titleElement = document.createElement("div");
    titleElement.className = "eden-tooltip-title";
    titleElement.textContent = title;
    EdenTooltipElement.appendChild(titleElement);
    EdenTooltipElement.appendChild(document.createTextNode(text));
    EdenTooltipElement.classList.add("eden-tooltip-visible");
    EdenMoveTooltip(event);
}

// Places the tooltip next to the mouse, flipping to the other side near the window's edges.
function EdenMoveTooltip(event) {
    const tooltip = EdenTooltipElement;
    if (!tooltip) return;
    const offset = 14;
    const left = event.clientX + offset + tooltip.offsetWidth > window.innerWidth ? event.clientX - offset - tooltip.offsetWidth : event.clientX + offset;
    const top = event.clientY + offset + tooltip.offsetHeight > window.innerHeight ? event.clientY - offset - tooltip.offsetHeight : event.clientY + offset;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${Math.max(0, top)}px`;
}

function EdenHideTooltip() {
    EdenTooltipTarget = null;
    EdenTooltipElement?.classList.remove("eden-tooltip-visible");
}

// One Fame badge. A stat changed by effects (bonus, from EdenGetCardView) is marked raised/lowered, with the change in its tooltip.
function EdenCreateFameBadge(className, value, bonus, tooltip, options) {
    const badge = document.createElement("div");
    badge.className = className;
    badge.textContent = value;
    if (bonus > 0) badge.classList.add("eden-card-game-card-stat-raised");
    if (bonus < 0) badge.classList.add("eden-card-game-card-stat-lowered");
    const change = bonus ? ` Changed by effects: ${bonus > 0 ? "+" : ""}${bonus} (normally ${value - bonus}).` : "";
    if (options.statTooltips) EdenAttachTooltip(badge, tooltip.title, tooltip.text + change);
    return badge;
}

/*
Renders a card definition (or an EdenGetCardView result).
options.clickable: clickable styling. options.statTooltips: Fame badge tooltips (big preview only).
*/
function EdenCardGameRenderCard(card, options = {}) {
    const cardElement = document.createElement("div");

    cardElement.className = "eden-card-game-card";
    cardElement.dataset.cardId = card.id;

    if (options.clickable) cardElement.classList.add("eden-card-game-card-clickable");

    const name = document.createElement("div");
    name.className = "eden-card-game-card-name";
    name.textContent = card.name;
    // The CSS uses this to shrink long names onto one line.
    name.style.setProperty("--eden-name-length", String(card.name.length));
    // Full name on hover, in case it's still truncated.
    name.title = card.name;

    const imageArea = document.createElement("div");
    imageArea.className = "eden-card-game-card-image-area";

    const fameBadges = document.createElement("div");
    fameBadges.className = "eden-card-game-card-fame-badges";

    if (typeof card.entryFame === "number") fameBadges.appendChild(EdenCreateFameBadge("eden-card-game-card-entry-fame", card.entryFame, card.entryFameBonus, EdenCardStatTooltips.entryFame, options));
    if (typeof card.exitFame === "number") fameBadges.appendChild(EdenCreateFameBadge("eden-card-game-card-exit-fame", card.exitFame, card.exitFameBonus, EdenCardStatTooltips.exitFame, options));

    const image = document.createElement("img");
    image.className = "eden-card-game-card-image";
    // Images come from the host game: Screens/MiniGame/ClubCard/{type}/{name}.png.
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
        // Group names bold, commas plain.
        card.groups.forEach((group, index) => {
            if (index > 0) groups.appendChild(document.createTextNode(", "));
            const name = document.createElement("strong");
            name.className = "eden-card-game-card-group";
            name.textContent = group;
            groups.appendChild(name);
        });
        textOverlay.appendChild(groups);
    }

    if (card.effect) {
        const effect = document.createElement("div");
        effect.className = "eden-card-game-card-effect";
        // Inline wrapper, or the flex effect box would turn each text piece and keyword into its own column.
        const effectText = document.createElement("span");
        EdenAppendHighlightedText(effectText, card.effect);
        effect.appendChild(effectText);
        textOverlay.appendChild(effect);
    }

    cardElement.appendChild(name);
    cardElement.appendChild(imageArea);
    cardElement.appendChild(textOverlay);

    return cardElement;
}

// Face-down card (e.g. the opponent's hand).
function EdenCardGameRenderSleeve() {
    const cardElement = document.createElement("div");
    cardElement.className = "eden-card-game-card eden-card-game-card-sleeve";

    const image = document.createElement("img");
    image.className = "eden-card-game-card-sleeve-image";
    image.src = `${EdenAddonAssets}edenSleeve.png`;
    image.alt = "Card";
    image.draggable = false;

    cardElement.appendChild(image);
    return cardElement;
}
