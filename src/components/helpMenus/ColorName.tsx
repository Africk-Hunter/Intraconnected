import React, { useSyncExternalStore } from 'react';
import { colorName, getActiveColor, subscribeLayers, type TokenKey } from '../../utilities/theme';

/** The name of a theme color as it is right now ("green", "dark violet"), following live edits. */
export function useColorName(token: TokenKey): string {
    return useSyncExternalStore(subscribeLayers, () => colorName(getActiveColor(token)));
}

interface Props {
    token: TokenKey;
    /** Capitalize for the start of a sentence. */
    cap?: boolean;
}

const ColorName: React.FC<Props> = ({ token, cap }) => {
    const name = useColorName(token);
    return <>{cap ? name.charAt(0).toUpperCase() + name.slice(1) : name}</>;
};

export default ColorName;
