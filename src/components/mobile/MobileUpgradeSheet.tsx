import { useState } from 'react';
import { WarningIcon } from '../Icons';
import PriceCheckIcon from '../landing/PriceCheckIcon';
import ExitPresence from './ExitPresence';
import { useSheetSwipeDown } from './useSheetSwipeDown';
import { useBackHandler } from '../../utilities/backStack';
import { useModalFocusTrap } from '../../utilities/useModalFocusTrap';
import type { PurchaseMode } from '../../utilities/billing/purchaseMode';
import { ANNUAL_PRICE_DISPLAY, ANNUAL_PRICE_PER_MONTH_DISPLAY } from '../../utilities/billing/pricingDisplay';

type Plan = 'annual' | 'lifetime';

// Which plan is ticked when the sheet opens (free plan, both offered).
const DEFAULT_PLAN: Plan = 'annual';

// Shared by both plans, so listed once instead of on each plan.
const INCLUDED = ['Unlimited nodes', 'Full feature access', 'Suggest new features'];

interface Props {
    open: boolean;
    onClose: () => void;
    mode: PurchaseMode;
    title: string;
    // The node-limit explanation when the cap opened the sheet, else null.
    notice: string | null;
    subtitle: string;
    showAnnual: boolean;
    lifetimePrice: string;
    // The undiscounted price, struck through, when an Annual credit applies.
    lifetimeWasPrice: string | null;
    lifetimeNote: string | null;
    lifetimeLoading: boolean;
    onUpgrade: (plan: Plan) => void;
    onOpenPricing: () => void;
    // Opened from Profile: shows Back (returns to Profile) instead of ✕.
    fromProfile?: boolean;
}

// The phone version of UpgradeModal: a bottom sheet with one plan picker and
// a single buy button pinned within thumb reach, instead of two stacked
// desktop price cards. Closes by ✕, Not now, scrim tap, swipe down and Back.
export default function MobileUpgradeSheet(props: Props) {
    return (
        <ExitPresence show={props.open}>
            <UpgradeSheetBody {...props} />
        </ExitPresence>
    );
}

function UpgradeSheetBody({
    onClose, mode, title, notice, subtitle, showAnnual,
    lifetimePrice, lifetimeWasPrice, lifetimeNote, lifetimeLoading, onUpgrade, onOpenPricing, fromProfile,
}: Props) {
    const [plan, setPlan] = useState<Plan>(showAnnual ? DEFAULT_PLAN : 'lifetime');
    const swipe = useSheetSwipeDown(onClose);
    useBackHandler(true, onClose, 3);
    useModalFocusTrap(true, swipe.sheetRef, onClose);

    const selected = showAnnual ? plan : 'lifetime';
    const ctaBusy = selected === 'lifetime' && lifetimeLoading;

    function handlePlanKey(e: React.KeyboardEvent) {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const next: Plan = selected === 'annual' ? 'lifetime' : 'annual';
        setPlan(next);
        (e.currentTarget.parentElement?.querySelector(`[data-plan="${next}"]`) as HTMLElement | null)?.focus();
    }

    function planOption(id: Plan) {
        const isAnnual = id === 'annual';
        const isSelected = selected === id;
        const content = (
            <>
                {showAnnual && <span className="mupgrade-plan-radio" aria-hidden="true" />}
                <span className="mupgrade-plan-main">
                    <span className="mupgrade-plan-name">{isAnnual ? 'Annual' : 'Lifetime'}</span>
                    <span className="mupgrade-plan-sub">
                        {isAnnual ? `${ANNUAL_PRICE_PER_MONTH_DISPLAY} a month, billed yearly` : 'Pay once, yours forever'}
                    </span>
                </span>
                <span className="mupgrade-plan-price">
                    {!isAnnual && lifetimeWasPrice && <s className="mupgrade-plan-was">{lifetimeWasPrice}</s>}
                    <strong key={isAnnual ? ANNUAL_PRICE_DISPLAY : lifetimePrice} className="mupgrade-plan-amount">
                        {isAnnual ? ANNUAL_PRICE_DISPLAY : lifetimePrice}
                    </strong>
                    <span className="mupgrade-plan-suffix">{isAnnual ? 'per year' : 'one time'}</span>
                </span>
                {!isAnnual && lifetimeNote && <span className="mupgrade-plan-note">{lifetimeNote}</span>}
            </>
        );
        const className = `mupgrade-plan mupgrade-plan--${id}${isSelected ? ' is-selected' : ''}`;

        // An Annual subscriber is only offered Lifetime: a summary, not a choice.
        if (!showAnnual) return <div key={id} className={className}>{content}</div>;
        return (
            <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                data-plan={id}
                className={className}
                onClick={() => setPlan(id)}
                onKeyDown={handlePlanKey}
            >
                {content}
            </button>
        );
    }

    return (
        <div className="mmobile-scrim mupgrade-scrim" onClick={onClose}>
            <div
                ref={swipe.sheetRef}
                className="mupgrade"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mupgradeTitle"
                tabIndex={-1}
            >
                <div className="mupgrade-top" {...swipe.dragProps}>
                    <div className="mmobile-sheet-grab" aria-hidden="true" />
                    <div className="mupgrade-head">
                        <h2 className="mupgrade-title" id="mupgradeTitle">{title}</h2>
                        {fromProfile ? (
                            <button type="button" className="mupgrade-back" onClick={onClose}>← Back</button>
                        ) : (
                            <button type="button" className="mmobile-help-close mupgrade-close" onClick={onClose} aria-label="Close">✕</button>
                        )}
                    </div>
                </div>

                <div className="mupgrade-body">
                    {notice ? (
                        <p className="mupgrade-notice">
                            <span className="mupgrade-notice-icon" aria-hidden="true"><WarningIcon /></span>
                            <span>{notice}</span>
                        </p>
                    ) : (
                        <p className="mupgrade-subtitle">{subtitle}</p>
                    )}

                    {mode === 'checkout' && (
                        <div className="mupgrade-plans" role={showAnnual ? 'radiogroup' : undefined} aria-label={showAnnual ? 'Choose a plan' : undefined}>
                            {showAnnual && planOption('annual')}
                            {planOption('lifetime')}
                        </div>
                    )}

                    {mode !== 'none' && (
                        <section className="mupgrade-includes" aria-labelledby="mupgradeIncludes">
                            <h3 className="mupgrade-includes-title" id="mupgradeIncludes">
                                {showAnnual ? 'Every plan includes' : 'Lifetime includes'}
                            </h3>
                            <ul className="mupgrade-includes-list">
                                {INCLUDED.map(label => (
                                    <li key={label}><PriceCheckIcon style="green" />{label}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <div className="mupgrade-footer">
                    {mode === 'checkout' && (
                        <>
                            <button
                                type="button"
                                className={`mupgrade-cta mupgrade-cta--${selected}`}
                                onClick={() => onUpgrade(selected)}
                                disabled={ctaBusy}
                            >
                                <span key={ctaBusy ? 'busy' : selected} className="mupgrade-swap">
                                    {ctaBusy ? 'Applying your credit…' : selected === 'annual' ? `Start Annual for ${ANNUAL_PRICE_DISPLAY}` : `Unlock Lifetime for ${lifetimePrice}`}
                                </span>
                            </button>
                            <p key={selected} className="mupgrade-fineprint mupgrade-swap">
                                {selected === 'annual'
                                    ? `Renews at ${ANNUAL_PRICE_DISPLAY}/yr. Cancel anytime.`
                                    : 'One payment. No renewals, no surprises.'}
                            </p>
                        </>
                    )}
                    {mode === 'link-out' && (
                        <button type="button" className="mupgrade-cta mupgrade-cta--lifetime" onClick={onOpenPricing}>
                            See plans on intraconnected.app
                        </button>
                    )}
                    <button type="button" className="mupgrade-dismiss" onClick={onClose}>
                        {mode === 'none' ? 'OK' : 'Not now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
