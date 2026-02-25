/**
 * Parses copy_original from a briefing into distinct sections: [HOOK 1], [HOOK 2], [BODY], etc.
 * @param {string} copyOriginal - The raw text of the briefing copy
 * @returns {Record<string, string>} A map of section names to their text content
 */
export function parseCopyToScenes(copyOriginal) {
    if (!copyOriginal) return {};
    const sections = {};
    const regex = /\[(HOOK\s*\d+|BODY)\]\s*\n([\s\S]*?)(?=\n\[(?:HOOK|BODY)|$)/gi;
    let match;
    while ((match = regex.exec(copyOriginal)) !== null) {
        sections[match[1].trim().toUpperCase()] = match[2].trim();
    }
    return sections;
}

/**
 * Maps a Scene database entity to its corresponding text from the parsed copy sections.
 * @param {Object} cena - The database scene entity
 * @param {Record<string, string>} copySections - The parsed sections object
 * @returns {string|null} The text for the given scene, or null if not found
 */
export function getTextForScene(cena, copySections) {
    if (!cena || !cena.tipo) return null;
    const tipo = cena.tipo.toUpperCase();
    if (tipo === 'HOOK') return copySections[`HOOK ${cena.ordem}`] || null;
    if (tipo === 'BODY') return copySections['BODY'] || null;
    return cena.texto_naracao || null;
}

export default { parseCopyToScenes, getTextForScene };
