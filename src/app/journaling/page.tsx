"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function JournalingPage() {
    // We have 4 journals initially. 
    // According to request: Left 2 (Top, Bottom), Right 1 (Full Height).
    // Wait, the user said "Left 2칸, Right 1칸". So total 3 active visible areas or 3 data points?
    // "각 네모칸 이름은 직접 기재할 수 있도록 변경"
    // "좌측 2칸, 우측 1칸 레이아웃으로 적용"
    // "우측 1칸은 사용자 입력과 동기화 될 수 있도록 적용"
    // Let's assume 3 items total.

    // Default titles
    const defaultTitles = ["💡 오늘의 배움", "🙏 감사한 점", "📝 자유 메모"];

    const [titles, setTitles] = useState<string[]>(defaultTitles);
    const [contents, setContents] = useState<string[]>(["", "", ""]);

    // Colors for the boxes
    const colors = [
        "border-blue-200 bg-blue-50/50 focus-within:ring-blue-500 dark:border-blue-800 dark:bg-blue-900/10", // Left Top
        "border-emerald-200 bg-emerald-50/50 focus-within:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-900/10", // Left Bottom
        "border-amber-200 bg-amber-50/50 focus-within:ring-amber-500 dark:border-amber-800 dark:bg-amber-900/10", // Right Full
    ];

    // Load from LocalStorage
    useEffect(() => {
        const savedData = localStorage.getItem("stanford_journaling_v2");
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.titles && parsed.titles.length === 3) setTitles(parsed.titles);
                if (parsed.contents && parsed.contents.length === 3) setContents(parsed.contents);
            } catch (e) {
                console.error("Failed to load journals", e);
            }
        }
    }, []);

    const saveData = (newTitles: string[], newContents: string[]) => {
        localStorage.setItem("stanford_journaling_v2", JSON.stringify({
            titles: newTitles,
            contents: newContents
        }));
    };

    const handleTitleChange = (index: number, value: string) => {
        const newTitles = [...titles];
        newTitles[index] = value;
        setTitles(newTitles);
        saveData(newTitles, contents);
    };

    const handleContentChange = (index: number, value: string) => {
        const newContents = [...contents];
        newContents[index] = value;
        setContents(newContents);
        saveData(titles, newContents);
    };

    return (
        <div className="min-h-screen p-4 md:p-8 bg-background flex flex-col">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
                <header className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <span className="text-4xl">📖</span> 스탠퍼드 저널링
                            </h1>
                            <p className="text-muted-foreground mt-1">하루를 회고하고 내일을 계획하는 공간입니다.</p>
                        </div>
                    </div>
                    <div className="text-sm text-emerald-600 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
                        <Save className="w-4 h-4" /> 자동 저장됨
                    </div>
                </header>

                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[600px]">
                    {/* Left Column (2 items) */}
                    <div className="flex flex-col gap-6 flex-1">
                        {/* Item 0 */}
                        <div className={`flex flex-col rounded-2xl border-2 p-6 transition-all flex-1 ${colors[0]}`}>
                            <input
                                value={titles[0]}
                                onChange={(e) => handleTitleChange(0, e.target.value)}
                                className="text-xl font-bold mb-4 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                            />
                            <textarea
                                value={contents[0]}
                                onChange={(e) => handleContentChange(0, e.target.value)}
                                placeholder="내용을 입력하세요..."
                                className="flex-1 w-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed placeholder:text-muted-foreground/40"
                            />
                        </div>
                        {/* Item 1 */}
                        <div className={`flex flex-col rounded-2xl border-2 p-6 transition-all flex-1 ${colors[1]}`}>
                            <input
                                value={titles[1]}
                                onChange={(e) => handleTitleChange(1, e.target.value)}
                                className="text-xl font-bold mb-4 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-emerald-300 rounded px-1"
                            />
                            <textarea
                                value={contents[1]}
                                onChange={(e) => handleContentChange(1, e.target.value)}
                                placeholder="내용을 입력하세요..."
                                className="flex-1 w-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed placeholder:text-muted-foreground/40"
                            />
                        </div>
                    </div>

                    {/* Right Column (1 item, full height) */}
                    <div className={`flex flex-col rounded-2xl border-2 p-6 transition-all flex-1 ${colors[2]}`}>
                        <input
                            value={titles[2]}
                            onChange={(e) => handleTitleChange(2, e.target.value)}
                            className="text-xl font-bold mb-4 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-300 rounded px-1"
                        />
                        <textarea
                            value={contents[2]}
                            onChange={(e) => handleContentChange(2, e.target.value)}
                            placeholder="내용을 입력하세요..."
                            className="flex-1 w-full bg-transparent resize-none focus:outline-none text-lg leading-relaxed placeholder:text-muted-foreground/40"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
