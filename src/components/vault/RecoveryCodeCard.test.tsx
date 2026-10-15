import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../firebaseConfig', () => ({
    auth: { currentUser: null },
}));

import RecoveryCodeCard from './RecoveryCodeCard';

describe('RecoveryCodeCard', () => {
    it('keeps the recovery code visible without requiring group confirmation', () => {
        const code = '0123-4567-89AB-CDEF-GHJK-MNPQ-RSTV-WXYZ';
        const markup = renderToStaticMarkup(
            <RecoveryCodeCard
                code={code}
                confirmLabel="Finish setup"
                busy={false}
                onConfirm={() => {}}
                onBack={() => {}}
            />
        );

        expect(markup).toContain(`aria-label="Recovery code">${code}</p>`);
        expect(markup).toContain('>Copy</button>');
        expect(markup).toContain('>Download</button>');
        expect(markup).not.toContain('placeholder="Group ');
        expect(markup).toMatch(/<button type="button" class="profile-action-btn neobrutal-button">Finish setup<\/button>/);
    });
});
