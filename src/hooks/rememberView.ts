import { useEffect } from 'react';
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

    useEffect(() => {
        if (!settings.rememberView) return;

        setTwoColumn(settings.viewTwoColumn);
        setSourceView(settings.viewSource);
        setOutline(settings.viewOutline);
        // Restore only once when the app starts
    }, []);

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
