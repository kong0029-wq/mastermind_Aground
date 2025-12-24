"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DynamicTable } from "@/components/DynamicTable";

export default function SchedulePage() {
    const initialScheduleData = [
        { date: "2024-01-01", time: "09:00 - 10:00", activity: "Kick-off Meeting", location: "Zoom", note: "전체 오리엔테이션" },
        { date: "2024-01-01", time: "10:00 - 12:00", activity: "환경 설정 및 툴 설치", location: "Individual", note: "VS Code, Node.js 확인" },
        { date: "2024-01-02", time: "14:00 - 16:00", activity: "React 기초 강의", location: "LMS", note: "Ch 1-3 수강" },
        { date: "2024-01-03", time: "09:00 - 11:00", activity: "팀 빌딩 세션", location: "Gather Town", note: "팀원 소개 및 역할 분담" },
        { date: "2024-01-05", time: "13:00 - 15:00", activity: "멘토링 세션", location: "Google Stick", note: "코드 리뷰 및 질의응답" },
        { date: "2024-01-08", time: "All Day", activity: "미니 프로젝트 시작", location: "-", note: "주제 선정 완료" },
        { date: "2024-01-15", time: "10:00 - 12:00", activity: "중간 점검", location: "Zoom", note: "진척사항 공유" },
    ];

    const [headers, setHeaders] = useState<string[]>(["Date", "Time", "Activity", "Location", "Note"]);
    const [data, setData] = useState<Record<string, any>[]>([]);
    const [meta, setMeta] = useState<any>(undefined);

    useEffect(() => {
        const saved = localStorage.getItem("stanford_schedule");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.headers) setHeaders(parsed.headers);
                if (parsed.data) setData(parsed.data);
            } catch (e) {
                console.error("Failed to load schedule", e);
            }
        } else {
            const normalized = initialScheduleData.map(item => ({
                "Date": item.date,
                "Time": item.time,
                "Activity": item.activity,
                "Location": item.location,
                "Note": item.note
            }));
            setData(normalized);
        }
    }, []);

    const handleSave = (newHeaders: string[], newData: Record<string, any>[], newMeta: any) => {
        setHeaders(newHeaders);
        setData(newData);
        setMeta(newMeta);
        localStorage.setItem("stanford_schedule", JSON.stringify({
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
                            <span className="text-4xl">📅</span> 스탠퍼드 일정표
                        </h1>
                        <p className="text-muted-foreground mt-1">전체 커리큘럼과 주요 일정을 한눈에 확인하세요.</p>
                    </div>
                </header>

                <div className="bg-card border rounded-xl shadow p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        * 일정표의 행/열을 자유롭게 편집할 수 있습니다.
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
