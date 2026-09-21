(function installRunHistoryPokemonSprites(global) {
    "use strict";

    const SELECTOR = "img[data-pokemon-asset]";
    const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

    function parseBoolean(value) {
        return /^(1|true|yes)$/i.test(String(value || ""));
    }

    function queryFromImage(image) {
        const data = image?.dataset || {};
        return {
            species: data.pokemonSpecies,
            nationalDex: data.pokemonNationalDex || undefined,
            appearanceId: data.pokemonAppearanceId || undefined,
            form: data.pokemonForm || undefined,
            gender: data.pokemonGender || "default",
            shiny: parseBoolean(data.pokemonShiny),
            view: data.pokemonView || "front",
            spriteType: data.pokemonSpriteType || "pixel",
        };
    }

    const local = loopback.has(global.location?.hostname);
    if (!(local ? global.PokemonAssets : global.PokemonAssetGateway)) {
        global.document?.querySelectorAll?.(SELECTOR).forEach(image => {
            image.hidden = true;
            image.dataset.pokemonAssetError = "resolver-not-loaded";
        });
        return;
    }

    const releaseBase = local ? "/Datasets/Pokemon%20Assets/release" : null;
    const meta = name => global.document?.querySelector?.(`meta[name="${name}"]`)?.content || "";
    const resolver = local
        ? global.PokemonAssets.createResolver({ baseUrl: releaseBase })
        : global.PokemonAssetGateway.createClient({ origin: meta("pokemon-asset-gateway-origin"), releaseVersion: meta("pokemon-asset-release-version") });

    async function bindImage(image) {
        if (!image || image.dataset.pokemonAssetBound === "true") return null;
        image.dataset.pokemonAssetBound = "true";
        try {
            return await resolver.setImage(image, queryFromImage(image));
        } catch (error) {
            image.removeAttribute("src");
            image.hidden = true;
            image.dataset.pokemonAssetError = "resolver-error";
            image.dataset.pokemonAssetErrorMessage = String(error?.message || error);
            return { status: "unavailable", reason: "resolver-error" };
        }
    }

    function refresh(root = global.document) {
        const images = root?.querySelectorAll?.(SELECTOR) || [];
        images.forEach(image => void bindImage(image));
        return images.length;
    }

    function start() {
        refresh();
        if (!global.MutationObserver || !global.document?.documentElement) return;
        const observer = new global.MutationObserver(records => {
            for (const record of records) for (const node of record.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches?.(SELECTOR)) void bindImage(node);
                refresh(node);
            }
        });
        observer.observe(global.document.documentElement, { childList: true, subtree: true });
    }

    global.RunHistoryPokemonSprites = Object.freeze({
        releaseBase,
        mode: local ? "local-resolver" : "published-gateway",
        queryFromImage,
        setImage: (image, query, callbacks) => resolver.setImage(image, query, callbacks),
        resolve: query => resolver.resolve(query),
        refresh,
        diagnostics: resolver.diagnostics,
    });

    if (global.document?.readyState === "loading") {
        global.document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})(globalThis);
