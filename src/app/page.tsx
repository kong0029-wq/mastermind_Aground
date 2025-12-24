"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  CheckSquare,
  Bell,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  ArrowRight
} from "lucide-react";

const menuItems = [
  {
    href: "/checkmate",
    label: "체크메이트",
    icon: CheckSquare,
    description: "오늘의 진행 상황을 확인하고 기록하세요.",
    color: "from-blue-500 to-emerald-500",
    primary: true
  },
  {
    href: "/notice",
    label: "정보 & 공지사항",
    icon: Bell,
    description: "최신 소식과 중요한 알림을 확인하세요.",
    color: "from-orange-500 to-red-500"
  },
  {
    href: "/peer-learning",
    label: "컨텐츠 피어러닝",
    icon: Users,
    description: "동료들과 함께 학습하고 성장하세요.",
    color: "from-purple-500 to-pink-500"
  },
  {
    href: "/journaling",
    label: "스탠퍼드 저널링",
    icon: BookOpen,
    description: "매일의 배움을 기록하고 성찰하세요.",
    color: "from-emerald-500 to-teal-500"
  },
  {
    href: "/schedule",
    label: "스탠퍼드 일정표",
    icon: Calendar,
    description: "전체 커리큘럼과 주요 일정을 확인하세요.",
    color: "from-blue-400 to-cyan-500"
  },
  {
    href: "/mission",
    label: "스탠퍼드 임무표",
    icon: ClipboardList,
    description: "수행해야 할 미션과 과제를 관리하세요.",
    color: "from-indigo-500 to-purple-600"
  },
];

export default function Home() {
  const [userGoal, setUserGoal] = useState("");

  // Load from local storage on mount
  useEffect(() => {
    const savedGoal = localStorage.getItem("aground_user_goal");
    if (savedGoal) {
      setUserGoal(savedGoal);
    }
  }, []);

  // Save to local storage on change
  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserGoal(newValue);
    localStorage.setItem("aground_user_goal", newValue);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent drop-shadow-sm">
            Aground 마스터 마인드
          </h1>

          <div className="max-w-2xl mx-auto">
            <input
              type="text"
              value={userGoal}
              onChange={handleGoalChange}
              placeholder="여기에 올해의 목표나 다짐을 입력하세요..."
              className="w-full px-4 py-3 text-center text-lg md:text-xl rounded-xl border-2 border-border bg-background/50 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
            />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${item.primary
                  ? "bg-gradient-to-br from-card to-background border-blue-500/50 shadow-blue-500/10"
                  : "bg-card border-border hover:border-primary/50"
                  }`}
              >
                <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br ${item.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold mb-2 flex items-center gap-2 group-hover:text-primary transition-colors">
                  {item.label}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </h2>

                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
