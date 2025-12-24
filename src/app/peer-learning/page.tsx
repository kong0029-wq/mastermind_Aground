"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, BookOpen, ExternalLink, Trash2, PlusCircle } from "lucide-react";
import Link from "next/link";

interface LearningCard {
    id: number;
    topic: string;
    link: string;
    keyLearning: string;
    author: string;
    date: string;
}

// Initial mock data
const initialCards: LearningCard[] = [
    {
        id: 1,
        topic: "Next.js App Router 구조",
        link: "https://nextjs.org/docs",
        keyLearning: "App Router의 폴더 기반 라우팅과 Layout 시스템의 효율성에 대해 학습함. Server Component의 이점 파악.",
        author: "김철수",
        date: "2024-01-02"
    },
];

export default function PeerLearningPage() {
    const [cards, setCards] = useState<LearningCard[]>(initialCards);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCard, setNewCard] = useState({ topic: "", link: "", keyLearning: "", author: "" });

    // Load from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem("aground_peer_learning");
        if (saved) {
            try {
                setCards(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load peer learning cards", e);
            }
        }
    }, []);

    // Save to LocalStorage
    const saveCards = (updatedCards: LearningCard[]) => {
        setCards(updatedCards);
        localStorage.setItem("aground_peer_learning", JSON.stringify(updatedCards));
    };

    const handleAddCard = () => {
        if (!newCard.topic || !newCard.keyLearning) {
            alert("주제와 핵심 배움은 필수 입력 항목입니다.");
            return;
        }

        const card: LearningCard = {
            id: Date.now(),
            topic: newCard.topic,
            link: newCard.link,
            keyLearning: newCard.keyLearning,
            author: newCard.author || "익명",
            date: new Date().toISOString().split('T')[0],
        };

        saveCards([card, ...cards]);
        setNewCard({ topic: "", link: "", keyLearning: "", author: "" });
        setIsModalOpen(false);
    };

    const handleDeleteCard = (id: number) => {
        if (confirm("이 학습 카드를 삭제하시겠습니까?")) {
            saveCards(cards.filter(c => c.id !== id));
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-muted rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <span className="text-4xl">🧠</span> 컨텐츠 피어러닝
                            </h1>
                            <p className="text-muted-foreground mt-1">동료들과 함께 나눈 지식과 인사이트를 공유합니다.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-105"
                    >
                        <PlusCircle className="w-5 h-5" /> 배움 공유하기
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div key={card.id} className="group bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full font-medium">
                                    {card.date}
                                </span>
                                <button
                                    onClick={() => handleDeleteCard(card.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold mb-3 line-clamp-2">{card.topic}</h3>

                            <div className="flex-1">
                                <p className="text-muted-foreground text-sm line-clamp-4 leading-relaxed mb-4">
                                    {card.keyLearning}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                                        {card.author[0]}
                                    </div>
                                    <span>{card.author}</span>
                                </div>
                                {card.link && (
                                    <a
                                        href={card.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                                    >
                                        Resouce <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {cards.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl mt-8">
                        <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-xl font-semibold">아직 공유된 배움이 없습니다.</p>
                        <p className="mt-2 text-sm">첫 번째 지식을 공유해보세요!</p>
                    </div>
                )}

                {/* Write Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6">
                                <h2 className="text-2xl font-bold mb-1">배움 공유하기</h2>
                                <p className="text-sm text-muted-foreground mb-6">오늘 새롭게 배운 내용을 기록하세요.</p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">주제 <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                            placeholder="무엇에 대해 배웠나요?"
                                            value={newCard.topic}
                                            onChange={(e) => setNewCard({ ...newCard, topic: e.target.value })}
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">핵심 배움 <span className="text-red-500">*</span></label>
                                        <textarea
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 transition-all min-h-[120px] resize-none"
                                            placeholder="주요 인사이트를 요약해주세요..."
                                            value={newCard.keyLearning}
                                            onChange={(e) => setNewCard({ ...newCard, keyLearning: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5">참고 링크</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20"
                                                placeholder="https://..."
                                                value={newCard.link}
                                                onChange={(e) => setNewCard({ ...newCard, link: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5">작성자</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20"
                                                placeholder="이름"
                                                value={newCard.author}
                                                onChange={(e) => setNewCard({ ...newCard, author: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleAddCard}
                                        disabled={!newCard.topic.trim() || !newCard.keyLearning.trim()}
                                        className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                    >
                                        공유하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
