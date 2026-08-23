import { useEffect, useState } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import { useIdeaContext } from '../../context/IdeaContext';
import { signUserOut, deleteUserAccount, sendPasswordReset, resendVerificationEmail, refreshEmailVerified } from '../../utilities/firebase/authFirebase';
import { auth } from '../../firebaseConfig';
import { fetchFullIdeaList } from '../../utilities/idea/helpers';
import { cancelSubscription, resetSubscriptionForTesting, requestLifetimeRefund, isLifetimeRefundEligible } from '../../utilities/billing/billing';
import { getCachedBillingStatus, BillingStatus } from '../../utilities/firebase/firebaseHelpers';
import { SUPPORT_EMAIL } from '../../utilities/support';
import '../../styles/profileModal.scss';

type Tab = 'account' | 'customization';
type MobileView = 'tabs' | 'account';

function ProfileModal() {
    const { profileModalOpen, setProfileModalOpen, billingPlan, setBillingPlan, setUpgradeModalOpen, setUpgradeModalReason } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<Tab>('account');
    const [mobileView, setMobileView] = useState<MobileView>('tabs');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [billingStatus, setBillingStatus] = useState<BillingStatus>(getCachedBillingStatus());
    const [cancelStep, setCancelStep] = useState<'idle' | 'confirm'>('idle');
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [isResettingPlan, setIsResettingPlan] = useState(false);
    const [resetPlanError, setResetPlanError] = useState('');
    const [refundStep, setRefundStep] = useState<'idle' | 'confirm' | 'done'>('idle');
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundError, setRefundError] = useState('');
    const [emailVerified, setEmailVerified] = useState(true);
    const [verifyResendSent, setVerifyResendSent] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [isCheckingVerified, setIsCheckingVerified] = useState(false);

    useEffect(() => {
        if (profileModalOpen) {
            setBillingStatus(getCachedBillingStatus());
            setEmailVerified(auth.currentUser?.emailVerified ?? true);
        }
    }, [profileModalOpen]);

    function handleOpenUpgrade() {
        handleClose();
        setUpgradeModalReason(null);
        setUpgradeModalOpen(true);
    }

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
        setCancelStep('idle');
        setCancelError('');
        setIsResettingPlan(false);
        setResetPlanError('');
        setVerifyResendSent(false);
        setVerifyError('');
        setIsCheckingVerified(false);
        setRefundStep('idle');
        setIsRefunding(false);
        setRefundError('');
    }

    async function handleResendVerification() {
        setVerifyError('');
        try {
            await resendVerificationEmail();
            setVerifyResendSent(true);
        } catch {
            setVerifyError('Failed to send verification email. Please try again.');
        }
    }

    async function handleCheckVerified() {
        setIsCheckingVerified(true);
        setVerifyError('');
        try {
            const verified = await refreshEmailVerified();
            setEmailVerified(verified);
            if (!verified) setVerifyError("Still not verified — check your inbox, or resend the email.");
        } catch {
            setVerifyError('Could not check verification status. Please try again.');
        } finally {
            setIsCheckingVerified(false);
        }
    }

    async function handleResetPlanForTesting() {
        setIsResettingPlan(true);
        setResetPlanError('');
        try {
            await resetSubscriptionForTesting();
            setBillingPlan('free');
            setBillingStatus(prev => ({
                ...prev,
                plan: 'free',
                stripeSubscriptionId: null,
                subscriptionStatus: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
            }));
            setCancelStep('idle');
        } catch {
            setResetPlanError('Failed to reset plan. Please try again.');
        } finally {
            setIsResettingPlan(false);
        }
    }

    async function handleCancelSubscription() {
        setIsCancelling(true);
        setCancelError('');
        try {
            await cancelSubscription();
            setBillingStatus(prev => ({ ...prev, cancelAtPeriodEnd: true }));
            setCancelStep('idle');
        } catch {
            setCancelError('Failed to cancel subscription. Please try again.');
        } finally {
            setIsCancelling(false);
        }
    }

    async function handleRefund() {
        setIsRefunding(true);
        setRefundError('');
        try {
            await requestLifetimeRefund();
            setRefundStep('done');
            // Not optimistic — unlike cancel/reset above, the plan doesn't
            // actually change here. Stripe processes the refund
            // asynchronously and reports back via charge.refunded, which the
            // Firestore listener already running (useBillingPlanSync in
            // Idea.tsx) will pick up on its own whenever it lands.
        } catch (err) {
            setRefundError(err instanceof Error ? err.message : 'Failed to process refund. Please try again.');
        } finally {
            setIsRefunding(false);
        }
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

    // Client-side, not a Netlify Function — ideas are only ever decrypted
    // in the browser (see E2E Encryption in CLAUDE.md), and fetchFullIdeaList()
    // already reads the decrypted copy straight out of localStorage, so
    // there's nothing for a server export endpoint to add here. Mirrors the
    // Blob/object-URL download pattern already used for the recovery code
    // in Auth.tsx.
    function handleExportData() {
        const user = auth.currentUser;
        const payload = {
            exportedAt: new Date().toISOString(),
            account: {
                email: user?.email ?? null,
                uid: user?.uid ?? null,
                accountCreated: user?.metadata?.creationTime ?? null,
            },
            ideas: fetchFullIdeaList(),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intraconnected-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
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

    const planLabel = billingPlan === 'annual' ? 'Annual' : billingPlan === 'lifetime' ? 'Lifetime' : 'Free';

    const accountContent = (
        <div className="profile-account-content">
            {/* Plan */}
            <section className="profile-section profile-section--plan">
                <h3 className="profile-section-title">Plan</h3>
                <p className="profile-section-desc">You're on the <strong>{planLabel}</strong> plan.</p>
                {billingPlan === 'free' && (
                    <button className="profile-action-btn neobrutal-button" onClick={handleOpenUpgrade}>
                        Upgrade
                    </button>
                )}
                {billingPlan === 'annual' && (
                    <div className="profile-plan-actions">
                        <button
                            className="profile-action-btn neobrutal-button"
                            onClick={handleOpenUpgrade}
                        >
                            Upgrade to Lifetime
                        </button>

                        {billingStatus.cancelAtPeriodEnd ? (
                            <p className="profile-section-desc profile-plan-cancel-note">
                                Your subscription is set to cancel
                                {billingStatus.currentPeriodEnd
                                    ? ` on ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}`
                                    : ' at the end of your billing period'}
                                . You'll keep access until then.
                            </p>
                        ) : cancelStep === 'confirm' ? (
                            <div className="profile-plan-cancel-confirm">
                                <p className="profile-section-desc">
                                    Cancel your annual subscription? You'll keep access until the end of your current billing period.
                                </p>
                                <div className="profile-plan-cancel-buttons">
                                    <button
                                        className="profile-action-btn neutral neobrutal-button"
                                        onClick={() => setCancelStep('idle')}
                                        disabled={isCancelling}
                                    >
                                        Keep plan
                                    </button>
                                    <button
                                        className="profile-action-btn danger neobrutal-button"
                                        onClick={handleCancelSubscription}
                                        disabled={isCancelling}
                                    >
                                        {isCancelling ? 'Cancelling…' : 'Confirm cancellation'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="profile-action-btn danger neobrutal-button"
                                onClick={() => setCancelStep('confirm')}
                            >
                                Cancel subscription
                            </button>
                        )}
                        {cancelError && <p className="profile-error">{cancelError}</p>}
                    </div>
                )}
                {billingPlan === 'lifetime' && (
                    <div className="profile-plan-actions">
                        {refundStep === 'done' ? (
                            <p className="profile-section-desc">
                                Refund submitted — your plan will update automatically once Stripe confirms it.
                            </p>
                        ) : !isLifetimeRefundEligible(billingStatus.updatedAt) ? (
                            <p className="profile-section-desc">
                                The 14-day self-serve refund window has passed. Need help? Email{' '}
                                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                            </p>
                        ) : refundStep === 'confirm' ? (
                            <div className="profile-plan-cancel-confirm">
                                <p className="profile-section-desc">
                                    Refund your Lifetime purchase? This immediately revokes access and can't be undone from here.
                                </p>
                                <div className="profile-plan-cancel-buttons">
                                    <button
                                        className="profile-action-btn neutral neobrutal-button"
                                        onClick={() => setRefundStep('idle')}
                                        disabled={isRefunding}
                                    >
                                        Keep it
                                    </button>
                                    <button
                                        className="profile-action-btn danger neobrutal-button"
                                        onClick={handleRefund}
                                        disabled={isRefunding}
                                    >
                                        {isRefunding ? 'Processing…' : 'Confirm refund'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="profile-action-btn danger neobrutal-button"
                                onClick={() => setRefundStep('confirm')}
                            >
                                Request a refund
                            </button>
                        )}
                        {refundError && <p className="profile-error">{refundError}</p>}
                    </div>
                )}
            </section>

            {/* Verify Email — only shown when unverified; gates upgrading (see create-payment-intent.ts) */}
            {!emailVerified && (
                <section className="profile-section profile-section--verify">
                    <h3 className="profile-section-title">Verify Your Email</h3>
                    <p className="profile-section-desc">
                        Confirm your email address — it's required before you can upgrade, and it's how we'd reach you about your account.
                    </p>
                    <div className="profile-plan-actions">
                        <button
                            className="profile-action-btn neobrutal-button"
                            onClick={handleResendVerification}
                            disabled={verifyResendSent}
                        >
                            {verifyResendSent ? 'Verification email sent' : 'Send verification email'}
                        </button>
                        <button
                            className="profile-action-btn neutral neobrutal-button"
                            onClick={handleCheckVerified}
                            disabled={isCheckingVerified}
                        >
                            {isCheckingVerified ? 'Checking…' : "I've verified — refresh"}
                        </button>
                    </div>
                    {verifyError && <p className="profile-error">{verifyError}</p>}
                </section>
            )}

            {/* Developer Testing (dev builds only, never ships to prod) */}
            {import.meta.env.DEV && (
                <section className="profile-section profile-section--dev">
                    <h3 className="profile-section-title">Developer Testing</h3>
                    <p className="profile-section-desc">
                        Cancels any live Stripe subscription and resets your plan to Free. Dev-only.
                    </p>
                    <button
                        className="profile-action-btn danger neobrutal-button"
                        onClick={handleResetPlanForTesting}
                        disabled={isResettingPlan || billingPlan === 'free'}
                    >
                        {isResettingPlan ? 'Resetting…' : 'Reset to Free'}
                    </button>
                    {resetPlanError && <p className="profile-error">{resetPlanError}</p>}
                </section>
            )}

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

            {/* Export Data */}
            <section className="profile-section profile-section--export">
                <h3 className="profile-section-title">Export Your Data</h3>
                <p className="profile-section-desc">Download a copy of your ideas and account info as a JSON file.</p>
                <button className="profile-action-btn neobrutal-button" onClick={handleExportData}>
                    Export data
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

            {/* Support */}
            <p className="profile-support">
                Need help? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
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
