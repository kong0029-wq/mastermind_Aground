"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DynamicTable } from "@/components/DynamicTable";

interface Mission {
    id: number;
    category: string;
    task: string;
    status: "Completed" | "In Progress" | "Pending" | string;
    dueDate: string;
}

const initialMissionsData: Mission[] = [
    { id: 1, category: "Project", task: "Next.js 초기 세팅 및 구조 설계", status: "Completed", dueDate: "2024-01-10" },
    { id: 2, category: "Study", task: "React Server Components 학습", status: "In Progress", dueDate: "2024-01-15" },
    { id: 3, category: "Project", task: "데이터베이스 스키마 설계", status: "Pending", dueDate: "2024-01-20" },
    { id: 4, category: "Study", task: "Tailwind CSS 심화 학습", status: "Pending", dueDate: "2024-01-25" },
    { id: 5, category: "Personal", task: "일일 저널링 습관화", status: "In Progress", dueDate: "2024-02-01" },
];

export default function MissionPage() {
    // Initial headers
    const [headers, setHeaders] = useState<string[]>(["ID", "Category", "Task", "Status", "Due Date"]);

    // Data state for DynamicTable (array of objects with keys from headers)
    const [data, setData] = useState<Record<string, any>[]>([]);
    const [meta, setMeta] = useState<any>(undefined);

    useEffect(() => {
        const saved = localStorage.getItem("stanford_missions");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.headers) setHeaders(parsed.headers);
                if (parsed.data) setData(parsed.data);
            } catch (e) {
                console.error("Failed to load missions", e);
            }
        } else {
            // Transform initial data to match DynamicTable expectation
            // We need to map object keys to the headers order if we want to be strict, 
            // but DynamicTable handles array conversion if we pass array of objects matching header order?
            // Actually DynamicTable logic I wrote:
            // "if (initialData.length > 0 && !Array.isArray(initialData[0]))" -> converts using initialHeaders
            // So we just pass the objects, but keys must match headers? 
            // The initial headers are "ID", "Category"... but object keys are "id", "category".
            // So we need to normalize this first.

            const normalized = initialMissionsData.map(m => ({
                "ID": m.id,
                "Category": m.category,
                "Task": m.task,
                "Status": m.status,
                "Due Date": m.dueDate
            }));
            setData(normalized);
        }
    }, []);

    const handleSave = (newHeaders: string[], newData: Record<string, any>[], newMeta: any) => {
        setHeaders(newHeaders);
        setData(newData);
        setMeta(newMeta);
        localStorage.setItem("stanford_missions", JSON.stringify({
            headers: newHeaders,
            data: newData,
            meta: newMeta
        }));
    };

    return (
        <div className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <span className="text-4xl">📋</span> 스탠퍼드 임무표
                        </h1>
                        <p className="text-muted-foreground mt-1">수행해야 할 핵심 미션과 과제 목록입니다.</p>
                    </div>
                </header>

                <div className="bg-card rounded-xl shadow border overflow-hidden p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        * 표의 행/열을 자유롭게 추가하거나 삭제할 수 있습니다. 각 셀을 클릭하여 내용을 수정하세요.
                    </p>
                    <DynamicTable
                        initialHeaders={headers}
                        initialData={data}
                        onSave={handleSave}
                    />
                </div>
            </div>
        </div>
    );
}
