/*
Player settings, kept in localStorage (edenCardGameSettings):
- autoSpectate: watch online games in the room automatically (default true).
- background: game board background name (default: the host game's Club Card background).
- sleeve: card back, "eden" (the addon's) or a host game sleeve number (default "eden").
The settings window opens from the Eden Card Club room and the online lobby.
*/

const EdenSettingsKey = "edenCardGameSettings";
const EdenSleeveFolder = "Screens/MiniGame/ClubCard/Sleeve/";

let EdenSettingsElement = null;
// Runs after the window closes (the online lobby reopens itself).
/** @type {(() => void) | null} */
let EdenSettingsOnClose = null;
// "main" or "sleeve" (the sleeve selection page).
let EdenSettingsPage = "main";
// The sleeve picked on the sleeve page, saved only with Save.
let EdenSettingsPendingSleeve = null;

function EdenGetSettings() {
    try {
        return JSON.parse(localStorage.getItem(EdenSettingsKey) ?? "{}") ?? {};
    } catch {
        return {};
    }
}

function EdenSaveSetting(key, value) {
    const settings = EdenGetSettings();
    settings[key] = value;
    try {
        localStorage.setItem(EdenSettingsKey, JSON.stringify(settings));
    } catch (error) {
        console.error("Eden Card Game: could not save settings.", error);
    }
}

// The chosen background, else the player's Club Card background from the host game, else its default board.
function EdenGetBackgroundName() {
    // Player only exists inside the host game.
    return EdenGetSettings().background ?? (typeof Player !== "undefined" && Player.Game?.ClubCard?.Background ? Player.Game.ClubCard.Background : "ClubCardPlayBoard1");
}

function EdenGetSleeve() {
    return EdenGetSettings().sleeve ?? "eden";
}

// Anything that isn't a known host game sleeve (another player's bad value, or outside the game) is the Eden sleeve.
function EdenGetSleeveUrl(sleeve = EdenGetSleeve()) {
    return typeof sleeve === "number" && EdenGetSleeveChoices().includes(sleeve) ? `${EdenSleeveFolder}${sleeve}.png` : `${EdenAddonAssets}edenSleeve.png`;
}

// A game seat's sleeve, picked by that player with their deck (the AI's deck has none, so it uses the Eden sleeve).
function EdenGetSeatSleeveUrl(ECPlayer) {
    return EdenGetSleeveUrl(ECPlayer.fullDeck.sleeve ?? "eden");
}

// "eden" plus the host game's sleeves (0 to ClubCardBuilderCardBackCount, as in its Club Card builder).
function EdenGetSleeveChoices() {
    const choices = ["eden"];
    if (EdenInHostGame) for (let i = 0; i <= (typeof ClubCardBuilderCardBackCount === "number" ? ClubCardBuilderCardBackCount : 14); i++) choices.push(i);
    return choices;
}

/*
Settings window, laid out like the host game's Club Card builder: buttons open the background and sleeve selection.
*/

/** @param {(() => void) | null} onClose */
function EdenOpenSettings(onClose = null) {
    EdenRemoveSettings();
    EdenSettingsOnClose = onClose;
    EdenSettingsPage = "main";
    EdenSettingsElement = EdenCreateElement("div", "eden-online-lobby-overlay");
    EdenSettingsElement.id = "eden-settings";
    document.body.appendChild(EdenSettingsElement);
    EdenRefreshSettings();
}

// Removes the window without running onClose (used when leaving for the background screen).
function EdenRemoveSettings() {
    EdenSettingsElement?.remove();
    EdenSettingsElement = null;
}

function EdenCloseSettings() {
    EdenRemoveSettings();
    const onClose = EdenSettingsOnClose;
    EdenSettingsOnClose = null;
    onClose?.();
}

function EdenRefreshSettings() {
    const settingsElement = EdenSettingsElement;
    if (!settingsElement) return;
    settingsElement.innerHTML = "";
    settingsElement.appendChild(EdenSettingsPage === "sleeve" ? EdenCreateSleeveSettings() : EdenCreateMainSettings());
}

function EdenCreateMainSettings() {
    const panel = EdenCreateElement("div", "eden-online-lobby eden-settings");
    panel.appendChild(EdenCreateElement("h2", "eden-online-lobby-title", "Settings"));

    // Auto Spectate
    const spectateRow = EdenCreateElement("label", "eden-online-lobby-row");
    const checkbox = EdenCreateElement("input", "");
    checkbox.type = "checkbox";
    checkbox.checked = EdenOnlineIsAutoSpectate();
    checkbox.addEventListener("change", () => EdenSaveSetting("autoSpectate", checkbox.checked));
    spectateRow.appendChild(checkbox);
    spectateRow.appendChild(EdenCreateElement("span", "", "Auto Spectate (watch online games in the room automatically)"));
    panel.appendChild(spectateRow);

    // Background and sleeve: the current choice, and a button to change it.
    const choices = EdenCreateElement("div", "eden-settings-choices");
    // The background screen belongs to the host game.
    if (typeof BackgroundSelectionMake === "function") {
        const background = EdenCreateElement("div", "eden-settings-current");
        const image = EdenCreateElement("img", "eden-settings-background-image");
        image.src = `${EdenGameBackgroundFolder}${EdenGetBackgroundName()}.jpg`;
        image.alt = EdenGetBackgroundName();
        background.appendChild(image);
        background.appendChild(EdenOnlineLobbyButton("Change Background", EdenOpenBackgroundSelection));
        choices.appendChild(background);
    }
    const sleeve = EdenCreateElement("div", "eden-settings-current");
    const sleeveImage = EdenCreateElement("img", "eden-settings-sleeve-image");
    sleeveImage.src = EdenGetSleeveUrl();
    sleeveImage.alt = "Card Sleeve";
    sleeve.appendChild(sleeveImage);
    sleeve.appendChild(EdenOnlineLobbyButton("Change Sleeve", () => {
        EdenSettingsPage = "sleeve";
        EdenSettingsPendingSleeve = EdenGetSleeve();
        EdenRefreshSettings();
    }));
    choices.appendChild(sleeve);
    panel.appendChild(choices);

    const buttons = EdenCreateElement("div", "eden-online-lobby-buttons");
    buttons.appendChild(EdenOnlineLobbyButton("Close", EdenCloseSettings));
    panel.appendChild(buttons);
    return panel;
}

// Sleeve selection page: click a sleeve to pick it, then Save or Cancel (both return to the main page).
function EdenCreateSleeveSettings() {
    const panel = EdenCreateElement("div", "eden-online-lobby eden-settings");
    panel.appendChild(EdenCreateElement("h2", "eden-online-lobby-title", "Card Sleeve"));

    const grid = EdenCreateElement("div", "eden-settings-sleeve-grid");
    for (const sleeve of EdenGetSleeveChoices()) {
        const choice = EdenCreateElement("button", `eden-settings-choice${sleeve === EdenSettingsPendingSleeve ? " eden-settings-choice-selected" : ""}`);
        choice.title = sleeve === "eden" ? "Eden" : `Sleeve ${sleeve + 1}`;
        const image = EdenCreateElement("img", "eden-settings-sleeve-image");
        image.src = EdenGetSleeveUrl(sleeve);
        image.alt = choice.title;
        choice.appendChild(image);
        choice.addEventListener("click", () => {
            EdenSettingsPendingSleeve = sleeve;
            EdenRefreshSettings();
        });
        grid.appendChild(choice);
    }
    panel.appendChild(grid);

    const buttons = EdenCreateElement("div", "eden-online-lobby-buttons");
    buttons.appendChild(EdenOnlineLobbyButton("Save", () => {
        EdenSaveSetting("sleeve", EdenSettingsPendingSleeve);
        EdenSettingsPage = "main";
        EdenRefreshSettings();
    }));
    buttons.appendChild(EdenOnlineLobbyButton("Cancel", () => {
        EdenSettingsPage = "main";
        EdenRefreshSettings();
    }));
    panel.appendChild(buttons);
    return panel;
}

// The host game's background selection screen (as its Club Card builder uses), then back to this screen and the settings.
function EdenOpenBackgroundSelection() {
    const module = CurrentModule;
    const screen = CurrentScreen;
    const onClose = EdenSettingsOnClose;
    EdenRemoveSettings();
    BackgroundSelectionMake(BackgroundsClubCardsTagList, EdenGetBackgroundName(), async (name, setBackground) => {
        if (setBackground) EdenSaveSetting("background", name);
        await CommonSetScreen(module, screen);
        EdenOpenSettings(onClose);
    });
}
