import { useEffect, useState, type ReactNode } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import { useIdeaContext } from '../../context/IdeaContext';
import { getMailProvider, resetMailUrl } from '../../utilities/mailProvider';
import { signUserOut,deleteUserAccount, sendPasswordReset, resendVerificationEmail, refreshEmailVerified } from '../../utilities/firebase/authFirebase';
import { auth } from '../../firebaseConfig';
import { fetchFullIdeaList } from '../../utilities/idea/helpers';
import { checkDevPassword } from '../../utilities/devPassword';
import { cancelSubscription, resetSubscriptionForTesting, setPlanForTesting, requestLifetimeRefund, isLifetimeRefundEligible } from '../../utilities/billing/billing';
import { getCachedBillingStatus, BillingStatus } from '../../utilities/billing/billingCache';
import { SUPPORT_EMAIL } from '../../utilities/support';
import { ideasToMarkdown, ideasToOpml } from '../../utilities/idea/exporters';
import type { SortMode } from '../../utilities/idea/sorting';
import { downloadFile } from '../../utilities/download';
import { useSmoothHeight } from '../../utilities/useSmoothHeight';
import ImportDataSection from './ImportDataSection';
import '../../styles/profileModal.scss';

type Tab = 'account' | 'data' | 'developer';
type ExportFormat = 'md' | 'opml' | 'json';

const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
    md: 'text/markdown',
    opml: 'text/x-opml',
    json: 'application/json',
};
type MobileView = 'tabs' | Tab;

// Developer tab only exists in dev builds — never ships to prod
const TABS: { id: Tab; label: string; desc: string }[] = [
    { id: 'account', label: 'Account', desc: 'Plan, password & account settings' },
    { id: 'data', label: 'Data', desc: 'Import & export your ideas' },
    ...(import.meta.env.DEV
        ? [{ id: 'developer' as const, label: 'Developer Testing', desc: 'Dev-only tools' }]
        : []),
];

function ProfileModal() {
    const { profileModalOpen, setProfileModalOpen, billingPlan, setBillingPlan, setUpgradeModalOpen, setUpgradeModalReason } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<Tab>('account');
    const [mobileView, setMobileView] = useState<MobileView>('tabs');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState('');
    const resetProvider = auth.currentUser?.email ? getMailProvider(auth.currentUser.email) : null;
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [billingStatus, setBillingStatus] = useState<BillingStatus>(getCachedBillingStatus());
    const [cancelStep, setCancelStep] = useState<'idle' | 'confirm'>('idle');
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [isResettingPlan, setIsResettingPlan] = useState(false);
    const [resetPlanError, setResetPlanError] = useState('');
    const [refundStep, setRefundStep] = useState<'idle' | 'confirm' | 'done'>('idle');
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundError, setRefundError] = useState('');
    const [devUnlocked, setDevUnlocked] = useState(false);
    const [devPasswordInput, setDevPasswordInput] = useState('');
    const [devPasswordError, setDevPasswordError] = useState('');
    const [isSettingPlan, setIsSettingPlan] = useState(false);
    const [setPlanError, setSetPlanError] = useState('');
    const [emailVerified, setEmailVerified] = useState(true);
    const [verifyResendSent, setVerifyResendSent] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const { contentRef, height: contentHeight, animate: animateHeight } = useSmoothHeight<HTMLDivElement>();

    useEffect(() => {
        if (profileModalOpen) {
            setBillingStatus(getCachedBillingStatus());
            setEmailVerified(auth.currentUser?.emailVerified ?? true);
            // Picks up a verification completed since the modal was last opened.
            refreshEmailVerified().then(setEmailVerified).catch(() => {});
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
        setRefundStep('idle');
        setIsRefunding(false);
        setRefundError('');
        setDevUnlocked(false);
        setDevPasswordInput('');
        setDevPasswordError('');
        setIsSettingPlan(false);
        setSetPlanError('');
    }

    async function handleResendVerification() {
        setVerifyError('');
        try {
            await resendVerificationEmail();
            setVerifyResendSent(true);
        } catch (error) {
            console.error('Verification email error:', error);
            const code = (error as { code?: string }).code;
            setVerifyError(
                code === 'auth/too-many-requests'
                    ? 'Too many attempts. Please wait a few minutes and try again.'
                    : 'Failed to send verification email. Please try again.'
            );
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

    async function handleDevUnlock() {
        if (await checkDevPassword(devPasswordInput)) {
            setDevUnlocked(true);
            setDevPasswordError('');
        } else {
            setDevPasswordError('Incorrect password.');
        }
        setDevPasswordInput('');
    }

    async function handleSetPlanForTesting(plan: 'annual' | 'lifetime') {
        setIsSettingPlan(true);
        setSetPlanError('');
        try {
            await setPlanForTesting(plan);
            setBillingPlan(plan);
            setBillingStatus(prev => ({
                ...prev,
                plan,
                stripeSubscriptionId: null,
                subscriptionStatus: plan === 'annual' ? 'active' : null,
                cancelAtPeriodEnd: false,
            }));
        } catch {
            setSetPlanError('Failed to set plan. Is ALLOW_TEST_RESET=true set in your local .env?');
        } finally {
            setIsSettingPlan(false);
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
    // Blob/object-URL download pattern. Never plan-gated — exporting is the no-lock-in promise.
    function handleExportData(format: ExportFormat) {
        const now = new Date();
        const ideas = fetchFullIdeaList();
        const sortMode = (localStorage.getItem('idea_sort_mode') as SortMode | null) ?? 'priority';
        let contents: string;
        if (format === 'md') {
            contents = ideasToMarkdown(ideas, { sortMode });
        } else if (format === 'opml') {
            contents = ideasToOpml(ideas, { sortMode, exportedAt: now });
        } else {
            const user = auth.currentUser;
            contents = JSON.stringify({
                exportedAt: now.toISOString(),
                account: {
                    email: user?.email ?? null,
                    uid: user?.uid ?? null,
                    accountCreated: user?.metadata?.creationTime ?? null,
                },
                ideas,
            }, null, 2);
        }
        downloadFile(contents, EXPORT_MIME_TYPES[format], `intraconnected-export-${now.toISOString().slice(0, 10)}.${format}`);
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
                // Server errors (no Firebase code) carry a user-facing message,
                // e.g. why the subscription couldn't be canceled.
                setDeleteError(!code && err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
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
                                Refund submitted, your plan will update automatically once Stripe confirms it.
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
                        Confirm your email address, it's required before you can upgrade, and it's how we'd reach you about your account.
                    </p>
                    <div className="profile-plan-actions">
                        <button
                            className="profile-action-btn neobrutal-button"
                            onClick={handleResendVerification}
                            disabled={verifyResendSent}
                        >
                            {verifyResendSent ? 'Verification email sent' : 'Send verification email'}
                        </button>
                    </div>
                    {verifyError && <p className="profile-error">{verifyError}</p>}
                </section>
            )}

            {/* Reset Password */}
            <section className="profile-section profile-section--reset">
                <h3 className="profile-section-title">Reset Password</h3>
                <div className="profile-reset-actions">
                    <button
                        className="profile-action-btn neobrutal-button"
                        onClick={handleResetPassword}
                        disabled={resetSent}
                    >
                        {resetSent ? 'Link sent to email' : 'Send reset link'}
                    </button>
                    {resetSent && resetProvider && (
                        <a
                            className="profile-action-btn profile-action-btn--link neobrutal-button"
                            href={resetMailUrl(auth.currentUser!.email!, resetProvider)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open {resetProvider.name}
                        </a>
                    )}
                </div>
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
                    onClick={() => setDeleteConfirmOpen(true)}
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

    const dataContent = (
        <div className="profile-account-content">
            {/* Export Data */}
            <section className="profile-section profile-section--export">
                <h3 className="profile-section-title">Export Your Data</h3>
                <p className="profile-section-desc">
                    Download a copy of your ideas anytime. Markdown for notes apps, OPML for other
                    mind-map and outliner apps, JSON for a full backup.
                </p>
                <div className="profile-export-buttons">
                    <button className="profile-action-btn neobrutal-button" onClick={() => handleExportData('md')}>
                        Markdown (.md)
                    </button>
                    <button className="profile-action-btn neobrutal-button" onClick={() => handleExportData('opml')}>
                        OPML (.opml)
                    </button>
                    <button className="profile-action-btn neobrutal-button" onClick={() => handleExportData('json')}>
                        JSON (.json)
                    </button>
                </div>
            </section>

            {/* Import Data */}
            <ImportDataSection onUpgrade={handleOpenUpgrade} />
        </div>
    );

    // Dev builds only — the tab itself is omitted from TABS in prod
    const developerContent = !devUnlocked ? (
        <div className="profile-account-content">
            <section className="profile-section profile-section--dev">
                <h3 className="profile-section-title">Password Required</h3>
                <p className="profile-section-desc">Enter the developer password to use these tools.</p>
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        void handleDevUnlock();
                    }}
                >
                    <input
                        className="profile-input"
                        type="password"
                        placeholder="Developer password"
                        value={devPasswordInput}
                        onChange={e => setDevPasswordInput(e.target.value)}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        className="profile-action-btn neobrutal-button"
                        disabled={!devPasswordInput}
                    >
                        Unlock
                    </button>
                </form>
                {devPasswordError && <p className="profile-error">{devPasswordError}</p>}
            </section>
        </div>
    ) : (
        <div className="profile-account-content">
            <section className="profile-section profile-section--dev">
                <h3 className="profile-section-title">Set Plan</h3>
                <p className="profile-section-desc">
                    Sets your plan directly with no payment or Stripe objects. Dev-only.
                </p>
                <div className="profile-export-buttons">
                    <button
                        className="profile-action-btn neobrutal-button"
                        onClick={() => handleSetPlanForTesting('annual')}
                        disabled={isSettingPlan || billingPlan === 'annual'}
                    >
                        Upgrade to Annual
                    </button>
                    <button
                        className="profile-action-btn neobrutal-button"
                        onClick={() => handleSetPlanForTesting('lifetime')}
                        disabled={isSettingPlan || billingPlan === 'lifetime'}
                    >
                        Upgrade to Lifetime
                    </button>
                </div>
                {setPlanError && <p className="profile-error">{setPlanError}</p>}
            </section>
            <section className="profile-section profile-section--dev">
                <h3 className="profile-section-title">Reset Plan</h3>
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
        </div>
    );

    const tabContent: Record<Tab, ReactNode> = {
        account: accountContent,
        data: dataContent,
        developer: import.meta.env.DEV ? developerContent : null,
    };

    return (
        <>
        <AnimatedOverlay open={profileModalOpen}>
            <div className="modal neobrutal profile-modal">
                {/* Height animates between tabs / content changes (see useSmoothHeight) */}
                <div
                    className={`profile-resize${animateHeight ? ' profile-resize--animate' : ''}`}
                    style={{ height: contentHeight }}
                >
                    <div ref={contentRef}>

                        {/* ── DESKTOP layout ── */}
                        <div className="profile-desktop">
                            <div className="profile-left">
                                <h2 className="profile-heading">Profile Options</h2>
                                {TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`profile-tab neobrutal-button${activeTab === tab.id ? ' profile-tab--active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                                <button
                                    className="profile-tab profile-tab--disabled neobrutal-button"
                                    disabled
                                >
                                    Customization
                                </button>
                            </div>
                            <div className="profile-right">
                                {tabContent[activeTab]}
                            </div>
                        </div>

                        {/* ── MOBILE layout ── */}
                        <div className="profile-mobile">
                            {mobileView === 'tabs' ? (
                                <>
                                    <h2 className="profile-heading">Profile Options</h2>
                                    {TABS.map(tab => (
                                        <button
                                            key={tab.id}
                                            className="profile-tab profile-tab--mobile neobrutal-button"
                                            onClick={() => setMobileView(tab.id)}
                                        >
                                            <div>
                                                <span className="profile-tab-label">{tab.label}</span>
                                                <span className="profile-tab-desc">{tab.desc}</span>
                                            </div>
                                            <span className="profile-tab-arrow">›</span>
                                        </button>
                                    ))}
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
                                    {tabContent[mobileView]}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Close button */}
                <button className="profile-close neobrutal-button" onClick={handleClose}>✕</button>
            </div>
        </AnimatedOverlay>

            <AnimatedOverlay open={deleteConfirmOpen}>
                <div className="modal neobrutal confirmModal">
                    <p className="confirmText">Are you sure you want to permanently delete your account and all your data? This cannot be undone.</p>
                    <section className="modalButtons">
                        <button className="modalButton cancel neobrutal-button" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
                        <button
                            className="modalButton delete neobrutal-button"
                            onClick={() => { setDeleteConfirmOpen(false); handleDeleteAccount(); }}
                        >
                            Delete
                        </button>
                    </section>
                </div>
            </AnimatedOverlay>
        </>
    );
}

export default ProfileModal;
