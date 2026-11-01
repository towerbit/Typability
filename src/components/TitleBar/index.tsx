import React, { useEffect, useRef } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { Button } from '@fluentui/react-components';
import styles from './title-bar.module.scss';
import { Add20Regular, ArrowDown20Regular, FullScreenMaximize20Regular } from '@fluentui/react-icons';
import FileMenu from '../FileMenu';
import EditMenu from '../EditMenu';
import { getDefaultStore, useAtom } from 'jotai';
import { aboutJotai, preferenceJotai, vibrancyJotai } from '../../jotais/ui';
import { Editor } from '@milkdown/core';
import { dirtyJotai, filePathJotai, savingJotai, untitledNameJotai } from '../../jotais/file';
import FilePath from './FilePath';
import { useIntl } from 'react-intl';
import { TauriEvent } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/api/dialog';
import classNames from 'classnames';

interface TitleBar {
    editorInstance: {
        current?: Editor | null;
    };
}

const TitleBar : React.FC<TitleBar> = ({editorInstance}) => {
    const [preference] = useAtom(preferenceJotai);
    const [about] = useAtom(aboutJotai);
    const [vibrancy] = useAtom(vibrancyJotai);
    const [filePath] = useAtom(filePathJotai);
    const [untitledName] = useAtom(untitledNameJotai);
    const [, setSaving] = useAtom(savingJotai);
    const titleBarRef = useRef<HTMLDivElement>(null);
    const intl = useIntl();
    const disableMenu = (e: MouseEvent) => {
        e.preventDefault();
    };
    useEffect(() => {
        if (!titleBarRef.current) return;
        titleBarRef.current.addEventListener('contextmenu', disableMenu);

        // Listen close event
        appWindow.listen(TauriEvent.WINDOW_CLOSE_REQUESTED, async () => {

            // Only ask when the content differs from the file it was opened with
            if (getDefaultStore().get(dirtyJotai)) {
                const result = await confirm(intl.formatMessage({
                    id: 'closeDialog.title',
                    defaultMessage: 'Do you need to save and then exit?'
                }), {
                    title: intl.formatMessage({
                        id: 'closeDialog.content',
                        defaultMessage: 'You haven\'t saved it yet'
                    }),
                    type: 'warning'
                });

                if (!result) return;

                await setSaving(true);
                // Keep the window open when saving was cancelled
                if (getDefaultStore().get(dirtyJotai)) return;
            }
            await appWindow.close();
        });

        return () => {
            if (!titleBarRef.current) return;
            titleBarRef.current.removeEventListener('contextmenu', disableMenu);
        };
    }, []);
    return (
        <>
            <div data-tauri-drag-region className={classNames(styles.bar, {
                [styles.mac]: vibrancy.vibrancy
            })} ref={titleBarRef} >
                {vibrancy.vibrancy && (
                    <div className={styles.trafficLights}>
                        <div
                            className={styles.light}
                            style={{
                                backgroundColor: '#ff5e57',
                                border: '1px solid #e0534d'
                            }}
                            onClick={async () => {
                                appWindow.emit(TauriEvent.WINDOW_CLOSE_REQUESTED);
                            }}
                        />
                        <div
                            className={styles.light}
                            style={{
                                backgroundColor: '#ffbb2e',
                                border: '1px solid #e0a528'
                            }}
                            onClick={async () => {
                                await appWindow.minimize();
                            }}
                        />
                        <div
                            className={styles.light}
                            style={{
                                backgroundColor: '#38c149',
                                border: '1px solid #31aa40'
                            }}
                            onClick={async () => {
                                await appWindow.toggleMaximize();
                            }}
                        />
                    </div>
                )}
                <div data-tauri-drag-region className={styles.title}>Typability</div>
                <div data-tauri-drag-region className={styles.operation}>
                    <FileMenu />
                    <div style={{ width: '0.5rem' }}></div>
                    <EditMenu editorInstance={editorInstance} />
                    <FilePath path={filePath ?? untitledName} />
                </div>
                {!vibrancy.vibrancy && (
                    <div className={styles.control}>
                        <Button
                            appearance="subtle"
                            icon={<ArrowDown20Regular />}
                            onClick={async () => {
                                await appWindow.minimize();
                            }}
                        />
                        <Button
                            appearance="subtle"
                            icon={<FullScreenMaximize20Regular />}
                            onClick={async () => {
                                await appWindow.toggleMaximize();
                            }}
                        />
                        <Button
                            appearance="subtle"
                            icon={<Add20Regular className={styles.close} />}
                            onClick={async () => {
                                appWindow.emit(TauriEvent.WINDOW_CLOSE_REQUESTED);
                            }}
                        />
                    </div>
                )}
            </div>
            {(preference || about) && <div data-tauri-drag-region className={styles.invisibleBar} />}
        </>
    );
};

export default TitleBar;