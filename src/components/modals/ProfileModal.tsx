import { useState } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import { useIdeaContext } from '../../context/IdeaContext';
import { signUserOut, deleteUserAccount, sendPasswordReset } from '../../utilities/firebase/authFirebase';
import { auth } from '../../firebaseConfig';
import '../../styles/profileModal.scss';

type Tab = 'account' | 'customization';
type MobileView = 'tabs' | 'account';

function ProfileModal() {
    const { profileModalOpen, setProfileModalOpen } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<Tab>('account');
    const [mobileView, setMobileView] = useState<MobileView>('tabs');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    function handleClose() {
        setProfileModalOpen(false);
        setActiveTab('account');
        setMobileView('tabs');
        setResetSent(false);
        setResetError('');
        setDeletePassword('');
        setDeleteConfirm('');
        setDeleteError('');
        setIsDeleting(false);
    }

    async function handleResetPassword() {
        const email = auth.currentUser?.email;
        if (!email) return;
        try {
            await sendPasswordReset(email);
            setResetSent(true);
            setResetError('');
        } catch {
            setResetError('Failed to send reset email. Please try again.');
        }
    }

    async function handleDeleteAccount() {
        if (deleteConfirm !== 'DELETE' || !deletePassword) return;
        setIsDeleting(true);
        setDeleteError('');
        try {
            await deleteUserAccount(deletePassword);
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setDeleteError('Incorrect password. Please try again.');
            } else {
                setDeleteError('Something went wrong. Please try again.');
            }
            setIsDeleting(false);
        }
    }

    const deleteEnabled = deleteConfirm === 'DELETE' && deletePassword.length > 0 && !isDeleting;

    const accountContent = (
        <div className="profile-account-content">
            {/* Reset Password */}
            <section className="profile-section profile-section--reset">
                <h3 className="profile-section-title">Reset Password</h3>
                <button
                    className="profile-action-btn neobrutal-button"
                    onClick={handleResetPassword}
                    disabled={resetSent}
                >
                    {resetSent ? 'Link sent to email' : 'Send reset link'}
                </button>
                {resetError && <p className="profile-error">{resetError}</p>}
            </section>

            {/* Log Out */}
            <section className="profile-section profile-section--logout">
                <h3 className="profile-section-title">Log Out</h3>
                <p className="profile-section-desc">Log out of account.</p>
                <button className="profile-action-btn neutral neobrutal-button" onClick={signUserOut}>
                    Log out
                </button>
            </section>

            {/* Delete Account */}
            <section className="profile-section profile-section--danger">
                <h3 className="profile-section-title profile-section-title--danger">Delete Account</h3>
                <p className="profile-section-desc">This permanently deletes all your data. This cannot be undone.</p>
                <input
                    id="profile-delete-password"
                    name="profile-delete-password"
                    className="profile-input neobrutal-input"
                    type="password"
                    placeholder="Current password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                />
                <input
                    id="profile-delete-confirm"
                    name="profile-delete-confirm"
                    className="profile-input neobrutal-input"
                    type="text"
                    placeholder='Type "DELETE" to confirm'
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                />
                {deleteError && <p className="profile-error">{deleteError}</p>}
                <button
                    className="profile-action-btn danger neobrutal-button"
                    onClick={handleDeleteAccount}
                    disabled={!deleteEnabled}
                >
                    {isDeleting ? 'Deleting…' : 'Delete account'}
                </button>
            </section>
        </div>
    );

    return (
        <AnimatedOverlay open={profileModalOpen}>
            <div className="modal neobrutal profile-modal">

                {/* ── DESKTOP layout ── */}
                <div className="profile-desktop">
                    <div className="profile-left">
                        <h2 className="profile-heading">Profile Options</h2>
                        <button
                            className={`profile-tab neobrutal-button${activeTab === 'account' ? ' profile-tab--active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            Account
                        </button>
                        <button
                            className="profile-tab profile-tab--disabled neobrutal-button"
                            disabled
                        >
                            Customization
                        </button>
                    </div>
                    <div className="profile-right">
                        {activeTab === 'account' && accountContent}
                    </div>
                </div>

                {/* ── MOBILE layout ── */}
                <div className="profile-mobile">
                    {mobileView === 'tabs' ? (
                        <>
                            <h2 className="profile-heading">Profile Options</h2>
                            <button
                                className="profile-tab profile-tab--mobile neobrutal-button"
                                onClick={() => setMobileView('account')}
                            >
                                <div>
                                    <span className="profile-tab-label">Account</span>
                                    <span className="profile-tab-desc">Password &amp; account settings</span>
                                </div>
                                <span className="profile-tab-arrow">›</span>
                            </button>
                            <button
                                className="profile-tab profile-tab--mobile profile-tab--disabled neobrutal-button"
                                disabled
                            >
                                <div>
                                    <span className="profile-tab-label">Customization</span>
                                    <span className="profile-tab-soon">Coming soon</span>
                                </div>
                                <span className="profile-tab-arrow">›</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="profile-back neobrutal-button" onClick={() => setMobileView('tabs')}>
                                ← Back
                            </button>
                            {accountContent}
                        </>
                    )}
                </div>

                {/* Close button */}
                <button className="profile-close neobrutal-button" onClick={handleClose}>✕</button>
            </div>
        </AnimatedOverlay>
    );
}

export default ProfileModal;
