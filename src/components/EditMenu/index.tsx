import React from 'react';
import { Menu, MenuButton, MenuDivider, MenuItem, MenuItemCheckbox, MenuList, MenuPopover, MenuTrigger } from '@fluentui/react-components';
import { DocumentEdit16Regular } from '@fluentui/react-icons';
import { useAtom } from 'jotai';
import { editMenuJotai, sourceViewJotai, toolbarJotai, twoColumnJotai } from '../../jotais/ui';
import { Editor, commandsCtx, editorViewCtx, parserCtx } from '@milkdown/core';
import { FormattedMessage } from 'react-intl';
import { InsertTable } from '@milkdown/preset-gfm';
import { settingsJotai } from '../../jotais/settings';

interface EditMenu {
    editorInstance: {
        current?: Editor | null;
    };
}

const mermaidMarkdown = `
\`\`\`mermaid
graph TD;
    EditorState-->EditorView;
    EditorView-->DOMEvent;
    DOMEvent-->Transaction;
    Transaction-->EditorState;
\`\`\`
`;

const EditMenu: React.FC<EditMenu> = ({editorInstance}) => {
    const [, setFloatingToolbar] = useAtom(toolbarJotai);
    const [settings] = useAtom(settingsJotai);
    const [, setEditMenu] = useAtom(editMenuJotai);
    const [twoColumn, setTwoColumn] = useAtom(twoColumnJotai);
    const [sourceView, setSourceView] = useAtom(sourceViewJotai);

    return (
        <Menu
            onOpenChange={(e, data) => {
                setEditMenu(data.open);
            }}
            hasCheckmarks
            checkedValues={{
                twoColumnEditor: twoColumn ? ['twoColumn'] : [],
                view: sourceView ? ['source'] : []
            }}
            onCheckedValueChange={(e, data) => {
                // The two views are mutually exclusive
                if (data.name === 'twoColumnEditor') {
                    const checked = data.checkedItems.includes('twoColumn');
                    setTwoColumn(checked);
                    if (checked) setSourceView(false);
                }
                if (data.name === 'view') {
                    const checked = data.checkedItems.includes('source');
                    setSourceView(checked);
                    if (checked) setTwoColumn(false);
                }
            }}
        >
            <MenuTrigger disableButtonEnhancement>
                <MenuButton
                    size="small"
                    appearance="subtle"
                    icon={<DocumentEdit16Regular />}
                >
                    <FormattedMessage
                        id='menu.edit.title'
                        defaultMessage='Edit'
                    />
                </MenuButton>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    <MenuItem disabled={sourceView} onClick={() => {
                        setFloatingToolbar('find');
                    }}>
                        <FormattedMessage
                            id='menu.edit.find'
                            defaultMessage='Find'
                        />
                    </MenuItem>
                    <MenuItem disabled={sourceView} onClick={() => {
                        setFloatingToolbar('replace');
                    }}>
                        <FormattedMessage
                            id='menu.edit.replace'
                            defaultMessage='Replace'
                        />
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                        disabled={sourceView || settings.syntax !== 'gfm'}
                        onClick={() => {
                            if (!editorInstance.current) return;
                            const commandManager = editorInstance.current.ctx.get(commandsCtx);
                            commandManager.call(InsertTable);
                        }}
                    >
                        <FormattedMessage
                            id='menu.edit.addTable'
                            defaultMessage='Add table'
                        />
                    </MenuItem>
                    <MenuItem disabled={sourceView} onClick={() => {
                        if (!editorInstance.current) return;
                        const editorView = editorInstance.current.ctx.get(editorViewCtx);
                        const parser = editorInstance.current.ctx.get(parserCtx);
                        const editorState = editorView.state;
                        const transaction = editorState.tr;
                        const mermaidNode = parser(mermaidMarkdown);
                        if (!mermaidNode) return;
                        editorView.dispatch(
                            transaction.insert(editorState.selection.$head.pos, mermaidNode)
                        );
                    }}>
                        <FormattedMessage
                            id='menu.edit.addDiagram'
                            defaultMessage='Add diagram'
                        />
                    </MenuItem>
                    <MenuItem disabled={sourceView} onClick={() => {
                        if (!editorInstance.current) return;
                        const editorView = editorInstance.current.ctx.get(editorViewCtx);
                        const parser = editorInstance.current.ctx.get(parserCtx);
                        const editorState = editorView.state;
                        const transaction = editorState.tr;
                        const mermaidNode = parser(`$\\sum_{i=0}^n i^2 = \\frac{(n^2+n)(2n+1)}{6}$`);
                        if (!mermaidNode) return;
                        editorView.dispatch(
                            transaction.insert(editorState.selection.$head.pos, mermaidNode)
                        );
                    }}>
                        <FormattedMessage
                            id='menu.edit.addFormula'
                            defaultMessage='Add formula'
                        />
                    </MenuItem>
                    <MenuDivider />
                    <MenuItemCheckbox
                        name='twoColumnEditor'
                        value='twoColumn'
                        persistOnClick={false}
                    >
                        <FormattedMessage
                            id='menu.edit.twoColumnEditor'
                            defaultMessage='Two-column Editor'
                        />
                    </MenuItemCheckbox>
                    <MenuItemCheckbox
                        name='view'
                        value='source'
                        persistOnClick={false}
                    >
                        <FormattedMessage
                            id='menu.edit.sourceView'
                            defaultMessage='Source code view'
                        />
                    </MenuItemCheckbox>
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};

export default EditMenu;
