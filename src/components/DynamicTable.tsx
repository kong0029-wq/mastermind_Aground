"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import { Lock, Unlock, Plus } from "lucide-react";
import "handsontable/dist/handsontable.full.min.css";

// Register Handsontable modules
registerAllModules();

export interface TableMeta {
    isLocked: boolean;
    colWidths: number[];
    rowHeights: number[];
    rowHeaders?: string[];
}

export interface DynamicTableUIConfig {
    lockModeLabel?: string;
    editModeLabel?: string;
    renameGuide?: string;
    lockedButton?: string;
    unlockedButton?: string;
    addRowButton?: string;
    addColumnButton?: string;
    newColumnDefaultName?: string;
    contextMenu?: {
        rename?: string;
        renameRow?: string;
        rowAbove?: string;
        rowBelow?: string;
        removeRow?: string;
        removeCol?: string;
    };
    renamePrompt?: string;
    renameRowPrompt?: string;
}

const DEFAULT_UI_CONFIG: DynamicTableUIConfig = {
    lockModeLabel: "잠금 모드 (읽기 전용)",
    editModeLabel: "편집 모드",
    renameGuide: "* 헤더(행/열) 우클릭으로 이름 변경 가능",
    lockedButton: "잠금 해제",
    unlockedButton: "잠금",
    addRowButton: "행 추가",
    addColumnButton: "열 추가",
    newColumnDefaultName: "New Col",
    contextMenu: {
        rename: '열 이름 변경 (Rename Column)',
        renameRow: '행 이름 변경 (Rename Row)',
        rowAbove: '위에 행 추가',
        rowBelow: '아래에 행 추가',
        removeRow: '행 삭제',
        removeCol: '열 삭제'
    },
    renamePrompt: "새로운 열 이름을 입력하세요:",
    renameRowPrompt: "새로운 행 이름을 입력하세요:"
};

interface DynamicTableProps {
    initialHeaders: string[];
    initialData: Record<string, any>[];
    initialMeta?: TableMeta;
    onSave: (headers: string[], data: Record<string, any>[], meta: TableMeta) => void;
    uiConfig?: DynamicTableUIConfig;
}

export function DynamicTable({ initialHeaders, initialData, initialMeta, onSave, uiConfig = {} }: DynamicTableProps) {
    const hotRef = useRef<any>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [headers, setHeaders] = useState<string[]>(initialHeaders);
    // Initialize row headers from meta, or default to 1, 2, 3...
    const [rowHeaders, setRowHeaders] = useState<string[]>(
        initialMeta?.rowHeaders || Array.from({ length: Math.max(initialData.length, 1) }, (_, i) => `${i + 1}`)
    );
    const [data, setData] = useState<any[]>([]);

    // Merge defaults with provided config - Memoize to prevent re-renders
    const config = React.useMemo(() => ({
        ...DEFAULT_UI_CONFIG,
        ...uiConfig,
        contextMenu: { ...DEFAULT_UI_CONFIG.contextMenu, ...uiConfig.contextMenu }
    }), [uiConfig]);

    useEffect(() => {
        setIsLocked(initialMeta?.isLocked ?? false);

        // Only update headers if they are different (deep comparison)
        if (JSON.stringify(headers) !== JSON.stringify(initialHeaders)) {
            setHeaders(initialHeaders);
        }

        // Update row headers if meta changes
        if (initialMeta?.rowHeaders && JSON.stringify(rowHeaders) !== JSON.stringify(initialMeta.rowHeaders)) {
            setRowHeaders(initialMeta.rowHeaders);
        }

        // Only update data if content is different
        let normalizedData: any[] = [];
        if (initialData.length > 0 && !Array.isArray(initialData[0])) {
            normalizedData = initialData.map(obj =>
                initialHeaders.map(h => obj[h] || "")
            );
        } else {
            normalizedData = initialData as any[];
        }

        if (JSON.stringify(data) !== JSON.stringify(normalizedData)) {
            setData(normalizedData);
            // If data length changed and we don't have enough row headers, sync them
            if (normalizedData.length > rowHeaders.length) {
                setRowHeaders(prev => {
                    const next = [...prev];
                    while (next.length < normalizedData.length) {
                        next.push(`${next.length + 1}`);
                    }
                    return next;
                });
            }
        }
    }, [initialHeaders, initialData, initialMeta]); // Logic inside handles bail-out, rowHeaders closure is stale but JSON check handles it unless rapid updates

    const handleSave = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;

        const currentData = hot.getData();
        const currentHeaders = headers;
        const currentRowHeaders = rowHeaders;

        const objectData = currentData.map((row: any[]) => {
            const obj: Record<string, any> = {};
            currentHeaders.forEach((h: string, i: number) => {
                obj[h] = row[i] || "";
            });
            return obj;
        });

        onSave(currentHeaders, objectData, {
            isLocked: isLocked,
            colWidths: [],
            rowHeights: [],
            rowHeaders: currentRowHeaders
        });
    }, [onSave, isLocked, headers, rowHeaders]);

    const toggleLock = useCallback(() => {
        const newState = !isLocked;
        setIsLocked(newState);
        // Save lock state
        const hot = hotRef.current?.hotInstance;
        if (hot) {
            const currentData = hot.getData();
            const currentHeaders = headers;
            const currentRowHeaders = rowHeaders; // Capture current row headers

            const objectData = currentData.map((row: any[]) => {
                const obj: Record<string, any> = {};
                currentHeaders.forEach((h: string, i: number) => {
                    obj[h] = row[i] || "";
                });
                return obj;
            });
            onSave(currentHeaders, objectData, {
                isLocked: newState,
                colWidths: [],
                rowHeights: [],
                rowHeaders: currentRowHeaders
            });
        }
    }, [isLocked, headers, rowHeaders, onSave]);

    const addColumn = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (hot) {
            hot.alter('insert_col_end');
            setHeaders(prev => [...prev, config.newColumnDefaultName || "New Col"]);
        }
    }, [config.newColumnDefaultName]);

    const addRow = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (hot) {
            hot.alter('insert_row_below');
            setRowHeaders(prev => [...prev, `${prev.length + 1}`]);
        }
    }, []);

    const afterChange = useCallback((changes: any, source: string) => {
        const validSources = ['edit', 'CopyPaste.paste', 'Autofill.fill', 'ContextMenu.clearValues', 'UndoRedo.undo', 'UndoRedo.redo'];
        if (!validSources.includes(source)) return;
        handleSave();
    }, [handleSave]);

    // Track context menu target
    const contextMenuTargetRef = useRef<{ row: number, col: number } | null>(null);

    const onBeforeContextMenuShow = useCallback((menu: any, coords?: any) => {
        // coords is an array of cell coords that were clicked/selected
        if (coords && coords.length > 0) {
            contextMenuTargetRef.current = coords[0];
        } else {
            contextMenuTargetRef.current = null;
        }
    }, []);

    // Custom Context Menu
    const contextMenuSettings = React.useMemo(() => {
        return {
            items: {
                'rename_col': {
                    name: config.contextMenu?.rename,
                    callback: function (key: any, selection: any, clickEvent: any) {
                        const hot = this as any;
                        let colIndex = -1;

                        // Priority 1: Use explicitly captured context menu target
                        if (contextMenuTargetRef.current && contextMenuTargetRef.current.row < 0) {
                            colIndex = contextMenuTargetRef.current.col;
                        }
                        // Priority 2: Use Selection
                        else if (selection && selection.length > 0) {
                            colIndex = selection[0].start.col;
                        }
                        // Priority 3: Fallback to last selected
                        else {
                            const selected = hot.getSelectedLast();
                            if (selected) {
                                colIndex = selected[1];
                            }
                        }

                        if (colIndex === -1) return;

                        // Try to find rect
                        let targetRect = null;
                        try {
                            const th = hot.view.wt.wtTable.getColumnHeader(colIndex);
                            if (th) targetRect = th.getBoundingClientRect();
                        } catch (e) { /* ignore */ }

                        if (!targetRect) {
                            targetRect = { top: window.innerHeight / 2 - 15, left: window.innerWidth / 2 - 100, width: 200, height: 30 };
                        }

                        const currentHeader = hot.getColHeader(colIndex) || `Col ${colIndex + 1}`;

                        setEditingHeader({
                            type: 'col',
                            index: colIndex,
                            rect: {
                                top: targetRect.top,
                                left: targetRect.left,
                                width: targetRect.width,
                                height: targetRect.height
                            },
                            value: currentHeader
                        });
                    }
                },
                'rename_row': {
                    name: config.contextMenu?.renameRow,
                    callback: function (key: any, selection: any) {
                        const hot = this as any;
                        let rowIndex = -1;

                        if (contextMenuTargetRef.current && contextMenuTargetRef.current.col < 0) {
                            rowIndex = contextMenuTargetRef.current.row;
                        }
                        else if (selection && selection.length > 0) {
                            rowIndex = selection[0].start.row;
                        } else {
                            const selected = hot.getSelectedLast();
                            if (selected) rowIndex = selected[0];
                        }

                        if (rowIndex === -1) return;

                        let targetRect = null;
                        // Try to approximate row header rect
                        try {
                            const cellRect = hot.getCellRect(rowIndex, 0);
                            const gridRect = hot.rootElement.getBoundingClientRect();
                            targetRect = {
                                top: cellRect.top + gridRect.top,
                                left: Math.max(0, cellRect.left + gridRect.left - 50),
                                width: 50,
                                height: cellRect.height
                            };
                        } catch (e) {
                            targetRect = { top: window.innerHeight / 2, left: 100, width: 50, height: 30 };
                        }

                        const currentHeader = hot.getRowHeader(rowIndex) || `${rowIndex + 1}`;

                        setEditingHeader({
                            type: 'row',
                            index: rowIndex,
                            rect: {
                                top: targetRect.top,
                                left: targetRect.left,
                                width: Math.max(targetRect.width, 100),
                                height: targetRect.height
                            },
                            value: currentHeader
                        });
                    }
                },
                'hsep0': "---------",
                'row_above': {
                    name: config.contextMenu?.rowAbove,
                    callback: function (key: any, selection: any) {
                        const hot = this as any;
                        const rowIndex = selection[0].start.row;
                        hot.alter('insert_row_above', rowIndex);
                        setRowHeaders(prev => {
                            const next = [...prev];
                            next.splice(rowIndex, 0, `${next.length + 1}`);
                            return next;
                        });
                    }
                },
                'row_below': {
                    name: config.contextMenu?.rowBelow,
                    callback: function (key: any, selection: any) {
                        const hot = this as any;
                        const rowIndex = selection[0].start.row;
                        hot.alter('insert_row_below', rowIndex);
                        setRowHeaders(prev => {
                            const next = [...prev];
                            next.splice(rowIndex + 1, 0, `${next.length + 1}`);
                            return next;
                        });
                    }
                },
                'remove_row': {
                    name: config.contextMenu?.removeRow,
                    callback: function (key: any, selection: any) {
                        const rowIndex = selection[0].start.row;
                        const count = selection[0].end.row - selection[0].start.row + 1;
                        const hot = this as any;
                        hot.alter('remove_row', rowIndex, count);

                        setRowHeaders(prev => {
                            const next = [...prev];
                            next.splice(rowIndex, count);
                            return next;
                        });
                    }
                },
                'hsep1': "---------",
                'remove_col': {
                    name: config.contextMenu?.removeCol,
                    callback: function (key: any, selection: any) {
                        const colIndex = selection[0].start.col;
                        const hot = this as any;
                        hot.alter('remove_col', colIndex);
                        setHeaders(prev => prev.filter((_, i) => i !== colIndex));
                    }
                }
            }
        } as any;
    }, [config]);

    // Inline Header Editing State
    const [editingHeader, setEditingHeader] = useState<{
        type: 'row' | 'col';
        index: number;
        rect: { top: number; left: number; width: number; height: number };
        value: string;
    } | null>(null);

    // Save handler for inline edit
    const handleHeaderEditSave = useCallback(() => {
        if (!editingHeader) return;

        const { type, index, value } = editingHeader;
        const hot = hotRef.current?.hotInstance;

        if (hot) {
            if (type === 'col') {
                const currentHeader = hot.getColHeader(index) || `Col ${index + 1}`;
                if (value !== currentHeader && value.trim() !== "") {
                    setHeaders(prev => {
                        const next = [...prev];
                        next[index] = value;
                        return next;
                    });
                }
            } else if (type === 'row') {
                const currentHeader = hot.getRowHeader(index) || `${index + 1}`;
                if (value !== currentHeader && value.trim() !== "") {
                    setRowHeaders(prev => {
                        const next = [...prev];
                        next[index] = value;
                        return next;
                    });
                }
            }
        }
        setEditingHeader(null);
    }, [editingHeader]);

    // Double-click on header to rename (Inline Input)
    const lastClickTimeRef = useRef<number>(0);
    const lastClickNodeRef = useRef<{ type: 'row' | 'col', index: number } | null>(null);

    const afterOnCellMouseDown = useCallback((event: MouseEvent, coords: any) => {
        if (isLocked) return;

        const now = Date.now();
        let clickType: 'row' | 'col' | null = null;
        let index = -1;

        if (coords.row < 0 && coords.col >= 0) {
            clickType = 'col';
            index = coords.col;
        } else if (coords.col < 0 && coords.row >= 0) {
            clickType = 'row';
            index = coords.row;
        }

        if (clickType) {
            const isRefDblClick =
                lastClickNodeRef.current &&
                lastClickNodeRef.current.type === clickType &&
                lastClickNodeRef.current.index === index &&
                (now - lastClickTimeRef.current < 500);

            const isNativeDblClick = (event as any).detail === 2 || (event as any).detail >= 2;

            if (isRefDblClick || isNativeDblClick || (event.ctrlKey || event.metaKey)) {
                const target = event.target as HTMLElement;
                const headerCell = target.closest('th') || target;
                const rect = headerCell.getBoundingClientRect();
                const hot = hotRef.current?.hotInstance;

                let currentValue = "";
                if (clickType === 'col') {
                    currentValue = hot?.getColHeader(index) || `Col ${index + 1}`;
                } else {
                    currentValue = hot?.getRowHeader(index) || `${index + 1}`;
                }

                setEditingHeader({
                    type: clickType,
                    index,
                    rect: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    },
                    value: currentValue
                });
            }

            lastClickTimeRef.current = now;
            lastClickNodeRef.current = { type: clickType, index };
        } else {
            lastClickNodeRef.current = null;
        }
    }, [isLocked]);

    // Auto-sync headers with data columns
    useEffect(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;

        const colCount = hot.countCols();
        if (colCount > headers.length) {
            setHeaders(prev => {
                const next = [...prev];
                while (next.length < colCount) {
                    next.push(`${config.newColumnDefaultName} ${next.length + 1}`);
                }
                return next;
            });
        }
    }, [data, headers.length, config.newColumnDefaultName]);

    // Effect to save whenever headers change
    const isMounted = useRef(false);
    useEffect(() => {
        if (isMounted.current) {
            handleSave();
        } else {
            isMounted.current = true;
        }
    }, [headers, rowHeaders]); // Removed handleSave to avoid loop loop

    const onStructureChange = useCallback((index: number, amount: number, source?: any) => {
        if (source === 'ContextMenu' || source === 'auto' || source === 'HitTest') {
            handleSave();
        }
    }, [handleSave]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between bg-card border rounded-lg p-2 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
                    {isLocked && <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 px-2 py-0.5 rounded text-xs font-semibold">{config.lockModeLabel}</span>}
                    {!isLocked && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold">{config.editModeLabel}</span>}
                    {!isLocked && <span className="text-xs ml-2 text-muted-foreground hidden sm:inline-block">{config.renameGuide}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleLock}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${isLocked
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                            }`}
                    >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {isLocked ? config.lockedButton : config.unlockedButton}
                    </button>
                    {!isLocked && (
                        <>
                            <button
                                onClick={addRow}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> {config.addRowButton}
                            </button>
                            <button
                                onClick={addColumn}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> {config.addColumnButton}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="border rounded-xl shadow-sm overflow-hidden bg-white dark:bg-black">
                <HotTable
                    ref={hotRef}
                    data={data}
                    colHeaders={headers}
                    rowHeaders={rowHeaders}
                    width="100%"
                    height="auto"
                    stretchH="all"
                    manualColumnResize={true}
                    manualRowResize={true}
                    contextMenu={!isLocked ? contextMenuSettings : false}
                    readOnly={isLocked}
                    afterChange={afterChange}
                    afterOnCellMouseDown={afterOnCellMouseDown}
                    afterCreateRow={onStructureChange}
                    afterRemoveRow={onStructureChange}
                    beforeContextMenuShow={onBeforeContextMenuShow}
                    licenseKey="non-commercial-and-evaluation"
                    autoWrapRow={true}
                    autoWrapCol={true}
                    minSpareRows={!isLocked ? 1 : 0}
                />
            </div>

            {/* Inline Header Editor */}
            {editingHeader && (
                <input
                    autoFocus
                    value={editingHeader.value}
                    onChange={(e) => setEditingHeader({ ...editingHeader, value: e.target.value })}
                    onBlur={handleHeaderEditSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleHeaderEditSave();
                        if (e.key === 'Escape') setEditingHeader(null);
                    }}
                    style={{
                        position: 'fixed',
                        top: editingHeader.rect.top,
                        left: editingHeader.rect.left,
                        width: editingHeader.rect.width,
                        height: editingHeader.rect.height,
                        zIndex: 9999,
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        padding: '0 4px',
                        boxSizing: 'border-box'
                    }}
                    className="bg-white dark:bg-gray-800 border-2 border-primary text-foreground shadow-lg rounded-sm outline-none"
                    onClick={(e) => e.stopPropagation()}
                />
            )}
            <style jsx global>{`
                .handsontable {
                  font-family: inherit;
                  font-size: 0.875rem;
                }
                .handsontable .htRight { text-align: right; }
                .handsontable .htCenter { text-align: center; }
                .handsontable .htJustify { text-align: justify; }
            `}</style>
        </div>
    );
}
