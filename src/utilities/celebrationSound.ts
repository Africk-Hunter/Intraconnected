// The upgrade celebration opens seconds after the Pay tap, once the webhook has
// updated the plan, and by then the browser no longer treats the page as having
// just been tapped, so a fresh Audio().play() is refused until the next tap
// (the "Let's go!" dismiss). A media element that was started during a tap stays
// allowed to play later, so the checkout primes this one silently on Pay and the
// celebration reuses it.
let sound: HTMLAudioElement | null = null;

export function getCelebrationSound(): HTMLAudioElement {
    if (!sound) {
        sound = new Audio('/sounds/roblox-badge.mp3');
        sound.volume = 0.7;
        sound.preload = 'auto';
    }
    return sound;
}

// Call synchronously from a tap/click handler.
export function primeCelebrationSound(): void {
    const audio = getCelebrationSound();
    audio.muted = true;
    audio.play()
        .then(() => {
            audio.pause();
            audio.currentTime = 0;
        })
        .catch(() => {})
        .finally(() => {
            audio.muted = false;
        });
}
