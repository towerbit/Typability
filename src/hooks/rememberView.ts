import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useUpdateEffect } from 'ahooks';
import { settingsJotai } from '../jotais/settings';
import { outlineJotai, sourceViewJotai, twoColumnJotai } from '../jotais/ui';

/*
 * When "remember view" is on, keep the state of the two-column, source code
 * and outline views in the settings, and restore them on startup.
 */
export default function useRememberView () {
    const [settings, setSettings] = useAtom(settingsJotai);
    const [twoColumn, setTwoColumn] = useAtom(twoColumnJotai);
    const [sourceView, setSourceView] = useAtom(sourceViewJotai);
    const [outline, setOutline] = useAtom(outlineJotai);
    const restored = useRef(false);

    useEffect(() => {
        if (restored.current || !settings.rememberView) return;
        restored.current = true;

        setTwoColumn(settings.viewTwoColumn);
        setSourceView(settings.viewSource);
        setOutline(settings.viewOutline);
    }, [settings, setTwoColumn, setSourceView, setOutline]);

    useUpdateEffect(() => {
        if (!settings.rememberView) return;

        setSettings((previous) => ({
            ...previous,
            viewTwoColumn: twoColumn,
            viewSource: sourceView,
            viewOutline: outline
        }));
    }, [twoColumn, sourceView, outline, settings.rememberView]);
}
