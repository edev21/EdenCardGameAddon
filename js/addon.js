(function () {
    if (window.EdenCardGameDeckBuilderAddonLoaded) return;

    window.EdenCardGameDeckBuilderAddonLoaded = true;

    // Get the folder where addon.js was loaded from
    /** @type {HTMLScriptElement | null} */
    const currentScript = document.currentScript instanceof HTMLScriptElement
        ? document.currentScript
        : document.querySelector("script[src$='addon.js'], script[src*='addon.js?']");

    if (!currentScript) {
        console.error("Could not find addon.js location.");
        return;
    }

    const baseUrl = new URL("../", currentScript.src).href;

    // Create the deck builder container
    let container = document.getElementById("eden-card-game-deck-builder");

    if (!container) {
        container = document.createElement("div");
        container.id = "eden-card-game-deck-builder";
        document.body.appendChild(container);
    }

    // Load CSS
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = baseUrl + "css/deck-builder.css";
    document.head.appendChild(style);

    // Load scripts one at a time so each dependency is ready before the next.
    /**
    * @param {string[]} files
    * @param {number} index
    */
    function EdenLoadScripts(files, index = 0) {
        if (index === files.length) {
            EdenShowOpenButton();
            EdenShowGameOpenButton();
            return;
        }

        const script = document.createElement("script");
        script.src = baseUrl + "js/" + files[index];
        script.onload = () => EdenLoadScripts(files, index + 1);
        script.onerror = () => console.error(`Card Game Addon failed to load ${files[index]}.`);
        document.head.appendChild(script);
    }

    EdenLoadScripts(["cards.js", "deck-storage.js", "card-renderer.js", "deck-builder.js", "card-game-state.js", "card-game.js"]);
})();