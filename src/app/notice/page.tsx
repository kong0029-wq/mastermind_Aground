"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DynamicTable, TableMeta } from "@/components/DynamicTable";

export default function NoticePage() {
    const [headers, setHeaders] = useState<string[]>(["ID", "Title", "Content", "Date", "Important"]);
    const [data, setData] = useState<Record<string, any>[]>([]);
    const [tableMeta, setTableMeta] = useState<TableMeta | undefined>(undefined);

    // Extra memo state
    const [memo, setMemo] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);

    // Editable Titles State
    const [pageTitle, setPageTitle] = useState("정보 & 공지사항");
    const [memoTitle, setMemoTitle] = useState("추가 메모 / 공지");
    const [isEditingPageTitle, setIsEditingPageTitle] = useState(false);
    const [isEditingMemoTitle, setIsEditingMemoTitle] = useState(false);

    useEffect(() => {
        const savedData = localStorage.getItem("aground_notices_table");
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setHeaders(parsed.headers || ["ID", "Title", "Content", "Date", "Important"]);
                setData(parsed.data || []);
                setTableMeta(parsed.meta);
            } catch (e) {
                console.error("Failed to parse notice data", e);
                setInitialData();
            }
        } else {
            setInitialData();
        }

        // Load memo
        const savedMemo = localStorage.getItem("aground_notice_memo");
        if (savedMemo) {
            setMemo(savedMemo);
        }

        // Load Titles
        const savedPageTitle = localStorage.getItem("aground_notice_page_title");
        if (savedPageTitle) setPageTitle(savedPageTitle);

        const savedMemoTitle = localStorage.getItem("aground_notice_memo_title");
        if (savedMemoTitle) setMemoTitle(savedMemoTitle);

        setIsInitialized(true);
    }, []);

    const setInitialData = () => {
        setData([
            { "ID": "1", "Title": "Stanford AI Coding", "Content": "Complete the course by Dec 31", "Date": "2024-12-01", "Important": "High" },
            { "ID": "2", "Title": "Week 1 Task", "Content": "Submit project proposal", "Date": "2024-12-07", "Important": "Medium" }
        ]);
        setHeaders(["ID", "Title", "Content", "Date", "Important"]);
    };

    const handleSave = (newHeaders: string[], newData: Record<string, any>[], newMeta: TableMeta) => {
        setHeaders(newHeaders);
        setData(newData);
        setTableMeta(newMeta);

        const payload = {
            headers: newHeaders,
            data: newData,
            meta: newMeta
        };
        localStorage.setItem("aground_notices_table", JSON.stringify(payload));
    };

    const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setMemo(newVal);
        localStorage.setItem("aground_notice_memo", newVal);
    };

    if (!isInitialized) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex items-center gap-4">
                    <Link href="/" className="p-2 rounded-full hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        {isEditingPageTitle ? (
                            <input
                                autoFocus
                                value={pageTitle}
                                onChange={(e) => setPageTitle(e.target.value)}
                                onBlur={() => {
                                    setIsEditingPageTitle(false);
                                    localStorage.setItem("aground_notice_page_title", pageTitle);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingPageTitle(false);
                                        localStorage.setItem("aground_notice_page_title", pageTitle);
                                    }
                                }}
                                className="text-3xl font-bold bg-background border-b-2 border-primary outline-none text-foreground w-full max-w-md"
                            />
                        ) : (
                            <h1
                                onClick={() => setIsEditingPageTitle(true)}
                                className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
                                title="클릭하여 수정"
                            >
                                {pageTitle}
                            </h1>
                        )}
                        <p className="text-muted-foreground mt-1">
                            중요한 공지사항과 자료를 공유하는 공간입니다.
                        </p>
                    </div>
                </header>

                <div className="space-y-6">
                    {/* Description Box */}
                    <div className="bg-card border rounded-xl shadow-sm p-4">
                        {isEditingMemoTitle ? (
                            <input
                                autoFocus
                                value={memoTitle}
                                onChange={(e) => setMemoTitle(e.target.value)}
                                onBlur={() => {
                                    setIsEditingMemoTitle(false);
                                    localStorage.setItem("aground_notice_memo_title", memoTitle);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingMemoTitle(false);
                                        localStorage.setItem("aground_notice_memo_title", memoTitle);
                                    }
                                }}
                                className="text-sm font-semibold mb-2 bg-background border-b border-muted-foreground outline-none text-foreground w-full max-w-xs"
                            />
                        ) : (
                            <h2
                                onClick={() => setIsEditingMemoTitle(true)}
                                className="text-sm font-semibold mb-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors inline-block"
                                title="클릭하여 수정"
                            >
                                {memoTitle}
                            </h2>
                        )}
                        <textarea
                            value={memo}
                            onChange={handleMemoChange}
                            placeholder="이곳에 자유롭게 추가 공지사항이나 참고 내용을 작성하세요..."
                            className="w-full min-h-[100px] p-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-card border rounded-xl shadow p-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            * 표의 행/열을 추가/삭제하거나 크기를 조절할 수 있습니다. 각 셀을 클릭하여 내용을 수정하세요.
                        </p>
                        <DynamicTable
                            initialHeaders={headers}
                            initialData={data}
                            initialMeta={tableMeta}
                            onSave={handleSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
