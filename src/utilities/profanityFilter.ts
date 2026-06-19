const BLOCKED = [
    'fuck', 'shit', 'bitch', 'cunt', 'cock', 'dick', 'pussy', 'asshole',
    'bastard', 'whore', 'slut', 'twat', 'prick', 'nigger', 'nigga',
    'faggot', 'retard', 'kike', 'spic', 'chink', 'wetback',
];

export function containsProfanity(text: string): boolean {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return BLOCKED.some(word => new RegExp(`\\b${word}\\b`).test(normalized));
}
