import { open as openUrl } from '@tauri-apps/api/shell';

/*
 * The link editing chip is rendered by milkdown's theme pack(@milkdown/theme-pack-helper),
 * it has a fixed width and a single "APPLY" button. This module widens it and adds an
 * "OPEN" button that opens the link with the default browser.
 */
const CHIP_SELECTOR = '.tooltip-input';
const LINK_PLACEHOLDER = 'Input Web Link';
const CHIP_WIDTH = '560px';
const OPEN_BUTTON_TEXT = 'OPEN';

function resolveUrl (value: string) {
    const url = value.trim();
    if (!url) return null;
    // Give a scheme to bare addresses like "github.com", otherwise the shell can't open it
    return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

function enhanceChip (chip: HTMLElement) {
    if (chip.dataset.openButton === 'true') return;

    const input = chip.querySelector('input');
    const applyButton = chip.querySelector('button');
    // The same chip is used for images, only the link one gets the extra button
    if (!input || !applyButton || input.placeholder !== LINK_PLACEHOLDER) return;

    chip.dataset.openButton = 'true';
    chip.style.width = CHIP_WIDTH;

    const openButton = document.createElement('button');
    openButton.textContent = OPEN_BUTTON_TEXT;
    openButton.addEventListener('mousedown', (event) => {
        // Don't let the apply handler close the chip before the link is opened
        event.preventDefault();
        event.stopPropagation();

        const url = resolveUrl(input.value);
        if (!url) return;

        openUrl(url).catch(() => undefined);
        // Hide the chip the same way the apply button does
        chip.classList.add('hide');
    });
    applyButton.after(openButton);
}

/** Add the "OPEN" button to the link chip, returns a disposer */
export default function enhanceLinkTooltip (container: HTMLElement) {
    const enhanceAll = () => {
        container.querySelectorAll<HTMLElement>(CHIP_SELECTOR).forEach(enhanceChip);
    };

    enhanceAll();
    const observer = new MutationObserver(enhanceAll);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
}
