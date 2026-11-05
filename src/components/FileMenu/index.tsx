import React from 'react';
import { Menu, MenuButton, MenuDivider, MenuItem, MenuList, MenuPopover, MenuTrigger } from '@fluentui/react-components';
import { Folder16Regular } from '@fluentui/react-icons';
import { useAtom } from 'jotai';
import  { open as openFilePicker, save as saveFilePicker } from '@tauri-apps/api/dialog';
import { documentDir } from '@tauri-apps/api/path';
import { contentJotai, dirtyJotai, filePathJotai, openFileJotai, saveAsJotai, savingJotai } from '../../jotais/file';
import { aboutJotai, preferenceJotai, toastJotai } from '../../jotais/ui';
import { FormattedMessage, useIntl } from 'react-intl';
import { exportAsDocx, exportAsHtml, exportAsPdf } from '../../utils/export';

const availbleExts = [{
    name: 'Markdown',
    extensions: ['md']
}, {
    name: 'Text file',
    extensions: ['txt']
}];

const availbleExportExts = [{
    name: 'HTML',
    extensions: ['html', 'htm']
}, {
    name: 'PDF',
    extensions: ['pdf']
}, {
    name: 'Word Document',
    extensions: ['docx']
}];

const FileMenu: React.FC = () => {
    const [content] = useAtom(contentJotai);
    const [filePath] = useAtom(filePathJotai);
    const [dirty] = useAtom(dirtyJotai);
    const [, setPreference] = useAtom(preferenceJotai);
    const [, setToast] = useAtom(toastJotai);
    const intl = useIntl();
    const [, setAbout] = useAtom(aboutJotai);
    const [, setSaving] = useAtom(savingJotai);
    const [, openFile] = useAtom(openFileJotai);
    const [, saveAs] = useAtom(saveAsJotai);
    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <MenuButton
                    size="small"
                    appearance="subtle"
                    icon={<Folder16Regular />}
                >
                    <FormattedMessage
                        id='menu.file.title'
                        defaultMessage='File'
                    />
                </MenuButton>
            </MenuTrigger>

            <MenuPopover>
                <MenuList>
                    <MenuItem onClick={async () => {
                        await openFile(null);
                    }}>
                        <FormattedMessage
                            id='menu.file.new'
                            defaultMessage='New'
                        />
                    </MenuItem>
                    <MenuItem onClick={async () => {
                        // @todo need refactor
                        const selected = await openFilePicker({
                            defaultPath: await documentDir(),
                            filters: availbleExts
                        });
                        if (selected === null) return;
                        await openFile(selected as string);
                    }}>
                        <FormattedMessage
                            id='menu.file.open'
                            defaultMessage='Open'
                        />
                    </MenuItem>
                    {/* A blank document still has to be saved once to get a path */}
                    <MenuItem disabled={!dirty && filePath !== null} onClick={async () => {
                        setSaving(true);
                    }}>
                        <FormattedMessage
                            id='menu.file.save'
                            defaultMessage='Save'
                        />
                    </MenuItem>
                    <MenuItem onClick={async () => {
                        await saveAs();
                    }}>
                        <FormattedMessage
                            id='menu.file.saveAs'
                            defaultMessage='Save as'
                        />
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem onClick={async () => {
                        // @todo need refactor
                        const selected = await saveFilePicker({
                            defaultPath: await documentDir(),
                            filters: availbleExportExts
                        });
                        if (selected === null) return;
                        const index = selected.lastIndexOf('.');
                        if (index === -1) return;
                        const ext = selected.substring(index + 1).toLowerCase();
                        try {
                            switch (ext) {
                            case 'htm':
                            case 'html':
                                await exportAsHtml(selected as string, content);
                                break;
                            case 'pdf':
                                await exportAsPdf(selected as string, content);
                                break;
                            case 'docx':
                                await exportAsDocx(selected as string, content);
                                break;
                            default:
                                throw new Error(`unsupported format: ${ext}`);
                            }

                            setToast({
                                id: Date.now(),
                                kind: 'success',
                                text: intl.formatMessage({
                                    id: 'menu.file.export.success',
                                    defaultMessage: 'Exported to {path}'
                                }, { path: selected })
                            });
                        } catch (error) {
                            setToast({
                                id: Date.now(),
                                kind: 'error',
                                text: intl.formatMessage({
                                    id: 'menu.file.export.failure',
                                    defaultMessage: 'Export failed: {reason}'
                                }, { reason: String(error) })
                            });
                        }
                    }}>
                        <FormattedMessage
                            id='menu.file.export'
                            defaultMessage='Export'
                        />
                    </MenuItem>
                    <MenuItem onClick={() => {
                        setPreference(true);
                    }}>
                        <FormattedMessage
                            id='menu.file.preference'
                            defaultMessage='Preference'
                        />
                    </MenuItem>
                    <MenuItem onClick={() => {
                        setAbout(true);
                    }}>
                        <FormattedMessage
                            id='menu.file.about'
                            defaultMessage='About'
                        />
                    </MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export default FileMenu;
