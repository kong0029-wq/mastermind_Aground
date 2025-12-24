"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Settings, Calendar as CalendarIcon, Save } from "lucide-react";

// --- Types ---

interface MateInfo {
    id: string;
    name: string;
    contact: string;
}

interface FineRecord {
    date: string;
    amount: number;
    name: string;
    note: string;
}

interface CheckItem {
    id: string;
    label: string;
    checked: boolean;
}

interface ProgressRecord {
    mateId: string;
    mateName: string;
    mateCallPartner: string;
    progressCheck: boolean;
    customChecks: CheckItem[];
    note: string;
}

// 날짜별 진행 기록 저장용 (YYYY-MM-DD -> ProgressRecord[])
type DailyHistory = Record<string, ProgressRecord[]>;

// --- Helper Functions ---

const getWeekNumber = (date: Date): number => {
    const target = new Date(date.valueOf());
    const dayNum = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNum + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target.getTime() - firstThursday.getTime();
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
};

const getMondayOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const getNextMonday = (date: Date): Date => {
    const monday = getMondayOfWeek(date);
    monday.setDate(monday.getDate() + 7);
    return monday;
};

const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
};

const seededShuffle = <T,>(array: T[], seed: number): T[] => {
    const result = [...array];
    let currentSeed = seed;
    const random = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
    };
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const generateBasicMatching = (count: number, seed: number): number[] => {
    if (count <= 1) return Array(count).fill(-1);
    const indices = Array.from({ length: count }, (_, i) => i);
    let shuffled = seededShuffle(indices, seed);
    for (let i = 0; i < shuffled.length; i++) {
        if (shuffled[i] === i) {
            const swapIdx = (i + 1) % shuffled.length;
            [shuffled[i], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[i]];
        }
    }
    return shuffled;
};

const generateRandomMatching = (count: number, weekSeed: number): number[] => {
    if (count <= 1) return Array(count).fill(-1);
    const previousMatchings: number[][] = [];
    for (let i = 1; i <= 2; i++) {
        const prevSeed = weekSeed - i;
        previousMatchings.push(generateBasicMatching(count, prevSeed));
    }
    let currentMatching = generateBasicMatching(count, weekSeed);
    let attempts = 0;
    while (attempts < 10) {
        let hasConflict = false;
        for (let i = 0; i < count; i++) {
            for (const prevMatching of previousMatchings) {
                if (prevMatching[i] === currentMatching[i]) {
                    hasConflict = true;
                    break;
                }
            }
            if (hasConflict) break;
        }
        if (!hasConflict) break;
        attempts++;
        currentMatching = generateBasicMatching(count, weekSeed + attempts * 1000);
    }
    return currentMatching;
};

const createDefaultLabels = (count: number): string[] => {
    const defaultNames = ["스레드 작성", "칼럼 작성", "저널링 작성", "가계부 작성"];
    return Array.from({ length: count }, (_, i) =>
        i < defaultNames.length ? defaultNames[i] : `항목 ${i + 1}`
    );
};

// --- Main Component ---

export default function CheckmatePage() {
    // 1. Core State
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );

    // 2. Settings State
    const [userCount, setUserCount] = useState<number>(3);
    const [checkItemCount, setCheckItemCount] = useState<number>(6);
    const [checkLabels, setCheckLabels] = useState<string[]>(() => createDefaultLabels(10));
    const [checkWeeklyCount, setCheckWeeklyCount] = useState<number[]>(() => Array(10).fill(7));
    const [mainWeeklyGoal, setMainWeeklyGoal] = useState<number>(5); // Default 5
    const [isSettingsLocked, setIsSettingsLocked] = useState<boolean>(false);
    const [isUserInfoLocked, setIsUserInfoLocked] = useState<boolean>(false);
    const [editClickCount, setEditClickCount] = useState<number>(0);
    const [userInfoEditClickCount, setUserInfoEditClickCount] = useState<number>(0);

    // 3. Data State
    const [mates, setMates] = useState<MateInfo[]>(() =>
        Array.from({ length: 10 }, (_, i) => ({
            id: String.fromCharCode(65 + i),
            name: "",
            contact: "",
        }))
    );
    const [fineRecords, setFineRecords] = useState<FineRecord[]>([
        { date: "", amount: 0, name: "", note: "" },
    ]);
    const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>(() =>
        Array.from({ length: 10 }, (_, i) => ({
            mateId: String.fromCharCode(65 + i),
            mateName: "",
            mateCallPartner: "",
            progressCheck: false,
            customChecks: Array.from({ length: 10 }, (_, idx) => ({
                id: `check-${idx}`,
                label: createDefaultLabels(10)[idx],
                checked: false,
            })),
            note: "",
        }))
    );
    const [dailyHistory, setDailyHistory] = useState<DailyHistory>({});

    // 4. New Features State
    const [bankInfo, setBankInfo] = useState<string>("");
    const [fineNotice, setFineNotice] = useState<string>("");

    // 5. Modals State
    const [showFineModal, setShowFineModal] = useState<boolean>(false);
    const [showMateDetailModal, setShowMateDetailModal] = useState<boolean>(false);
    const [selectedMateIndex, setSelectedMateIndex] = useState<number | null>(null);
    const [showCheckDetailModal, setShowCheckDetailModal] = useState<boolean>(false);
    const [selectedCheckIndex, setSelectedCheckIndex] = useState<number | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
    const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);

    // --- Persistence Logic ---

    // Load from LocalStorage
    useEffect(() => {
        const savedData = localStorage.getItem("checkmate_v2_data");
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.userCount) setUserCount(parsed.userCount);
                if (parsed.checkItemCount) setCheckItemCount(parsed.checkItemCount);
                if (parsed.checkLabels) setCheckLabels(parsed.checkLabels);
                if (parsed.checkWeeklyCount) setCheckWeeklyCount(parsed.checkWeeklyCount);
                // Load Main Weekly Goal
                if (parsed.mainWeeklyGoal) setMainWeeklyGoal(parsed.mainWeeklyGoal);

                if (parsed.isSettingsLocked !== undefined) setIsSettingsLocked(parsed.isSettingsLocked);
                if (parsed.isUserInfoLocked !== undefined) setIsUserInfoLocked(parsed.isUserInfoLocked);
                if (parsed.mates) setMates(parsed.mates);
                if (parsed.fineRecords) setFineRecords(parsed.fineRecords);
                if (parsed.dailyHistory) {
                    setDailyHistory(parsed.dailyHistory);
                    const today = new Date().toISOString().split("T")[0];
                    if (parsed.dailyHistory[today]) {
                        setProgressRecords(parsed.dailyHistory[today]);
                    }
                }
                if (parsed.bankInfo) setBankInfo(parsed.bankInfo);
                if (parsed.fineNotice) setFineNotice(parsed.fineNotice);
            } catch (e) {
                console.error("Failed to load data", e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save to LocalStorage
    useEffect(() => {
        if (!isInitialized) return;

        const updatedHistory = { ...dailyHistory, [selectedDate]: progressRecords };

        const dataToSave = {
            userCount,
            checkItemCount,
            checkLabels,
            checkWeeklyCount,
            mainWeeklyGoal, // Save goal
            isSettingsLocked,
            isUserInfoLocked,
            mates,
            fineRecords,
            dailyHistory: updatedHistory,
            bankInfo,
            fineNotice,
        };

        localStorage.setItem("checkmate_v2_data", JSON.stringify(dataToSave));
    }, [
        userCount, checkItemCount, checkLabels, checkWeeklyCount, mainWeeklyGoal, isSettingsLocked, isUserInfoLocked,
        mates, fineRecords, progressRecords, selectedDate, bankInfo, fineNotice, isInitialized
    ]);

    // --- Business Logic ---

    // Calculates the weekly total for the 'Main Check' (Mate Call)
    const calculateWeeklyMainCount = useCallback((mateId: string) => {
        const monday = getMondayOfWeek(new Date(selectedDate));
        let count = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            const dStr = formatDate(d).replace(/\./g, '-'); // YYYY-MM-DD

            let records: ProgressRecord[] | undefined;
            if (dStr === selectedDate) {
                records = progressRecords;
            } else {
                records = dailyHistory[dStr];
            }

            if (records) {
                const userRecord = records.find(r => r.mateId === mateId);
                if (userRecord && userRecord.progressCheck) {
                    count++;
                }
            }
        }
        return count;
    }, [dailyHistory, progressRecords, selectedDate]);

    const totalFine = useMemo(() => {
        return fineRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
    }, [fineRecords]);

    // 날짜 변경 핸들러
    const handleDateChange = (newDate: string) => {
        const updatedHistory = { ...dailyHistory, [selectedDate]: progressRecords };
        setDailyHistory(updatedHistory);
        setSelectedDate(newDate);

        if (updatedHistory[newDate]) {
            setProgressRecords(updatedHistory[newDate]);
        } else {
            const weekNumber = getWeekNumber(new Date(newDate));
            const yearSeed = new Date(newDate).getFullYear() * 100 + weekNumber;
            const matching = generateRandomMatching(userCount, yearSeed);

            const newRecords = Array.from({ length: 10 }, (_, i) => ({
                mateId: String.fromCharCode(65 + i),
                mateName: mates[i].name,
                mateCallPartner: "",
                progressCheck: false,
                customChecks: checkLabels.map((label, idx) => ({
                    id: `check-${idx}`,
                    label: label,
                    checked: false
                })),
                note: "",
            }));

            for (let i = 0; i < userCount; i++) {
                const partnerIdx = matching[i];
                if (partnerIdx >= 0 && partnerIdx < userCount) {
                    newRecords[i].mateCallPartner = mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`;
                }
            }

            setProgressRecords(newRecords);
        }
    };

    const applyRandomMatching = () => {
        const weekNumber = getWeekNumber(new Date(selectedDate));
        const yearSeed = new Date(selectedDate).getFullYear() * 100 + weekNumber;
        const randomSeed = yearSeed + Math.floor(Math.random() * 10000);
        const matching = generateRandomMatching(userCount, randomSeed);

        setProgressRecords(prev => {
            const newRecords = [...prev];
            for (let i = 0; i < userCount; i++) {
                const partnerIdx = matching[i];
                if (partnerIdx >= 0 && partnerIdx < userCount) {
                    newRecords[i] = {
                        ...newRecords[i],
                        mateCallPartner: mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`
                    };
                }
            }
            return newRecords;
        });
    };

    // 초기 랜덤 매칭
    useEffect(() => {
        if (isInitialized && !dailyHistory[selectedDate]) {
            const weekNumber = getWeekNumber(new Date(selectedDate));
            const yearSeed = new Date(selectedDate).getFullYear() * 100 + weekNumber;
            const matching = generateRandomMatching(userCount, yearSeed);

            setProgressRecords(prev => {
                const newRecords = [...prev];
                for (let i = 0; i < userCount; i++) {
                    const partnerIdx = matching[i];
                    if (partnerIdx >= 0 && partnerIdx < userCount) {
                        newRecords[i] = {
                            ...newRecords[i],
                            mateCallPartner: mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`
                        };
                    }
                }
                return newRecords;
            });
        }
    }, [userCount, isInitialized]);

    // --- UI Update Helpers ---

    const updateMateInfo = (index: number, field: keyof MateInfo, value: string) => {
        const newMates = [...mates];
        newMates[index] = { ...newMates[index], [field]: value };
        setMates(newMates);
        if (field === "name") {
            const newProgress = [...progressRecords];
            newProgress[index] = { ...newProgress[index], mateName: value };
            setProgressRecords(newProgress);
        }
    };

    const updateProgress = (index: number, field: keyof ProgressRecord, value: any) => {
        const newProgress = [...progressRecords];
        newProgress[index] = { ...newProgress[index], [field]: value };
        setProgressRecords(newProgress);
    };

    const updateCustomCheck = (mateIndex: number, checkIndex: number, checked: boolean) => {
        const newProgress = [...progressRecords];
        const newChecks = [...newProgress[mateIndex].customChecks];
        newChecks[checkIndex] = { ...newChecks[checkIndex], checked };
        newProgress[mateIndex] = { ...newProgress[mateIndex], customChecks: newChecks };
        setProgressRecords(newProgress);
    };

    const updateCheckLabel = (index: number, newLabel: string) => {
        const newLabels = [...checkLabels];
        newLabels[index] = newLabel;
        setCheckLabels(newLabels);
        setProgressRecords(prev => prev.map(record => ({
            ...record,
            customChecks: record.customChecks.map((check, idx) =>
                idx === index ? { ...check, label: newLabel } : check
            )
        })));
    };

    const updateCheckWeeklyCount = (index: number, value: number) => {
        const newCounts = [...checkWeeklyCount];
        newCounts[index] = value;
        setCheckWeeklyCount(newCounts);
    };

    const confirmSettings = () => { setIsSettingsLocked(true); setEditClickCount(0); };
    const handleEditClick = () => {
        if (editClickCount + 1 >= 3) { setIsSettingsLocked(false); setEditClickCount(0); }
        else setEditClickCount(p => p + 1);
    };

    const confirmUserInfo = () => { setIsUserInfoLocked(true); setUserInfoEditClickCount(0); };
    const handleUserInfoEditClick = () => {
        if (userInfoEditClickCount + 1 >= 3) { setIsUserInfoLocked(false); setUserInfoEditClickCount(0); }
        else setUserInfoEditClickCount(p => p + 1);
    };

    // --- Calendar Helpers for Monthly View ---
    const renderCalendar = () => {
        const today = new Date(selectedDate);
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const weeks = [];
        let currentWeek = Array(7).fill(null);

        for (let i = 0; i < startDayOfWeek; i++) {
            currentWeek[i] = null;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = new Date(dateStr).getDay();
            const hasData = !!dailyHistory[dateStr];

            currentWeek[dayOfWeek] = { day: d, dateStr, hasData };

            if (dayOfWeek === 6 || d === daysInMonth) {
                weeks.push(currentWeek);
                currentWeek = Array(7).fill(null);
            }
        }

        return (
            <div className="space-y-2">
                <h3 className="text-lg font-bold text-center mb-4">{year}년 {month + 1}월</h3>
                <div className="grid grid-cols-7 gap-1 text-center font-medium mb-2">
                    <div className="text-red-500">일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div className="text-blue-500">토</div>
                </div>
                {weeks.map((week, wIdx) => {
                    // [NEW] Calculate missed goals for this week
                    const missedUsers: string[] = [];
                    // Using the confirmed user logic to find misses
                    for (let uIdx = 0; uIdx < userCount; uIdx++) {
                        let kount = 0;
                        // Iterate through days in this week row logic
                        // Note: 'week' array contains objects or null. 
                        // We need to check Monday-Sunday for the 'week' represented by this row.
                        // However, the calendar view might split a week across months.
                        // Ideally, weekly goal is strictly Mon-Sun.
                        // Let's use the first valid date in this week row to find the Monday of that week.
                        const validDay = week.find(d => d !== null);
                        if (validDay) {
                            const monday = getMondayOfWeek(new Date(validDay.dateStr));
                            for (let i = 0; i < 7; i++) {
                                const d = new Date(monday);
                                d.setDate(d.getDate() + i);
                                const dStr = formatDate(d).replace(/\./g, '-');

                                let records: ProgressRecord[] | undefined;
                                if (dStr === selectedDate) records = progressRecords;
                                else records = dailyHistory[dStr];

                                if (records && records[uIdx] && records[uIdx].progressCheck) {
                                    kount++;
                                }
                            }
                        }

                        if (kount < mainWeeklyGoal) {
                            missedUsers.push(mates[uIdx].name || `사용자 ${mates[uIdx].id}`);
                        }
                    }

                    return (
                        <div key={wIdx} className="mb-2">
                            <div className="grid grid-cols-7 gap-1">
                                {week.map((dayInfo, dIdx) => (
                                    <div
                                        key={dIdx}
                                        className={`p-2 rounded-lg text-sm min-h-[40px] flex items-center justify-center border
                                        ${!dayInfo ? 'invisible' : ''}
                                        ${dayInfo?.dateStr === selectedDate ? 'ring-2 ring-blue-500' : ''}
                                        ${dayInfo?.hasData ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-muted/30 border-border'}
                                        cursor-pointer hover:bg-muted/50
                                    `}
                                        onClick={() => dayInfo && handleDateChange(dayInfo.dateStr)}
                                    >
                                        {dayInfo?.day}
                                    </div>
                                ))}
                            </div>
                            {missedUsers.length > 0 && (
                                <div className="mt-1 flex items-start gap-1 text-xs text-red-500 px-1">
                                    <span className="font-bold whitespace-nowrap">⚠️ 미달성:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {missedUsers.map((name, i) => (
                                            <span key={i} className="bg-red-500/10 px-1 rounded">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    * 날짜를 클릭하면 해당 일자의 기록으로 이동합니다.
                </p>
            </div>
        );
    };

    return (
        <div className="min-h-screen p-4 md:p-8 bg-background">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
                        🎯 체크메이트
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        오늘의 진행 상황을 확인하고 기록하세요
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                        title="체크 항목 설정"
                    >
                        <Settings className="w-5 h-5 text-foreground" />
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <section className="bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">👥</span>
                            사용자 정보 입력
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">사용자 수:</label>
                                <select
                                    value={userCount}
                                    onChange={(e) => setUserCount(Number(e.target.value))}
                                    disabled={isUserInfoLocked}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                                >
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                                        <option key={num} value={num}>{num}명</option>
                                    ))}
                                </select>
                            </div>
                            {!isUserInfoLocked ? (
                                <button onClick={confirmUserInfo} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm">✅ 확정</button>
                            ) : (
                                <button onClick={handleUserInfoEditClick} className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm">✏️ 수정 {userInfoEditClickCount > 0 && `(${3 - userInfoEditClickCount})`}</button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10">
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">No.</th>
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">이름</th>
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">연락처</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mates.slice(0, userCount).map((mate, index) => (
                                    <tr key={mate.id} className="hover:bg-muted/30">
                                        <td className="border border-border px-4 py-2 text-center text-sm">{mate.id}</td>
                                        <td className="border border-border px-2 py-2">
                                            <input type="text" value={mate.name} onChange={(e) => updateMateInfo(index, "name", e.target.value)} placeholder="이름" disabled={isUserInfoLocked} className="w-full px-2 py-1 text-sm rounded border bg-background text-foreground disabled:opacity-50" />
                                        </td>
                                        <td className="border border-border px-2 py-2">
                                            <input type="text" value={mate.contact} onChange={(e) => updateMateInfo(index, "contact", e.target.value)} placeholder="연락처" disabled={isUserInfoLocked} className="w-full px-2 py-1 text-sm rounded border bg-background text-foreground disabled:opacity-50" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-2xl">💰</span>
                            벌금 현황 및 안내
                        </h2>
                        <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 rounded-xl p-4 mb-4 flex justify-between items-center">
                            <div>
                                <p className="text-secondary-foreground text-sm font-medium mb-1">총 누적 벌금</p>
                                <p className="text-3xl font-bold text-red-500">{totalFine.toLocaleString()}원</p>
                            </div>
                            <button
                                onClick={() => setShowFineModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:opacity-90 font-medium text-sm"
                            >
                                📋 상세 / 추가
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">🏦 벌금 입금 계좌</label>
                                <input
                                    type="text"
                                    value={bankInfo}
                                    onChange={(e) => setBankInfo(e.target.value)}
                                    placeholder="예: 카카오뱅크 1234-56-7890 홍길동"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-amber-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">📢 벌금 안내 / 메모</label>
                                <textarea
                                    value={fineNotice}
                                    onChange={(e) => setFineNotice(e.target.value)}
                                    placeholder="벌금 관련 공지사항이나 규칙을 자유롭게 적어주세요."
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <section className="max-w-7xl mx-auto bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            메이트 콜 & 체크 진행 현황
                        </h2>
                        <button
                            onClick={() => setShowCalendarModal(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 text-sm font-medium transition-colors"
                        >
                            <CalendarIcon className="w-4 h-4" />
                            월별 현황
                        </button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg hover:bg-emerald-500/20 text-sm font-medium flex items-center gap-1"
                        >
                            ⚙️ 체크 항목 설정
                        </button>
                        <button onClick={() => applyRandomMatching()} className="px-3 py-1.5 bg-purple-500/10 text-purple-600 rounded-lg hover:bg-purple-500/20 text-sm font-medium">
                            🎲 랜덤 재매칭
                        </button>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-foreground">날짜:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="text-sm text-foreground mb-3 p-3 bg-purple-500/10 rounded-lg space-y-1">
                    <div className="flex flex-wrap gap-x-4">
                        <span>📅 <strong>{getWeekNumber(new Date(selectedDate))}주차</strong> Status</span>
                        <span>🔄 갱신: 매주 월요일</span>
                        <span className="text-muted-foreground">| 설정 아이콘(⚙️)을 눌러 체크 항목을 수정하세요.</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10">
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap">No.</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold">이름</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap">메이트콜 상대</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap">진행 체크</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap bg-blue-500/10">
                                    주간 합계
                                </th>
                                {checkLabels.slice(0, checkItemCount).map((label, idx) => (
                                    <th key={idx} className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap bg-emerald-500/5">
                                        {label}<br /><span className="text-xs font-normal">({checkWeeklyCount[idx]}회)</span>
                                    </th>
                                ))}
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold min-w-[150px]">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {progressRecords.slice(0, userCount).map((record, index) => {
                                const weeklyMainCount = calculateWeeklyMainCount(record.mateId);
                                const isGoalMet = weeklyMainCount >= mainWeeklyGoal;

                                return (
                                    <tr key={record.mateId} className="hover:bg-muted/30">
                                        <td className="border border-border px-3 py-2 text-center">{record.mateId}</td>
                                        <td onClick={() => { setSelectedMateIndex(index); setShowMateDetailModal(true); }} className="border border-border px-3 py-2 text-center cursor-pointer hover:text-blue-500 hover:underline font-medium">{record.mateName}</td>
                                        <td className="border border-border px-2 py-2">
                                            <select value={record.mateCallPartner} onChange={(e) => updateProgress(index, "mateCallPartner", e.target.value)} className="w-full p-1 text-sm rounded border bg-background">
                                                <option value="">선택</option>
                                                {mates.slice(0, userCount).filter((_, i) => i !== index).map(m => <option key={m.id} value={m.name || `메이트 ${m.id}`}>{m.name || `메이트 ${m.id}`}</option>)}
                                            </select>
                                        </td>
                                        <td className="border border-border px-2 py-2 text-center">
                                            <input type="checkbox" checked={record.progressCheck} onChange={e => updateProgress(index, "progressCheck", e.target.checked)} className="w-4 h-4 accent-blue-500" />
                                        </td>
                                        {/* 주간 합계(Main Check) Column */}
                                        <td className="border border-border px-2 py-2 text-center font-bold bg-blue-500/5">
                                            <span className={isGoalMet ? "text-blue-600" : "text-red-500"}>
                                                {weeklyMainCount}
                                            </span>
                                            <span className="text-muted-foreground text-xs font-normal"> / {mainWeeklyGoal}</span>
                                        </td>
                                        {record.customChecks.slice(0, checkItemCount).map((check, checkIdx) => (
                                            <td key={check.id} className="border border-border px-2 py-2 text-center bg-emerald-500/5">
                                                <input type="checkbox" checked={check.checked} onChange={e => updateCustomCheck(index, checkIdx, e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                                            </td>
                                        ))}
                                        <td className="border border-border px-2 py-2">
                                            <input type="text" value={record.note} onChange={e => updateProgress(index, "note", e.target.value)} className="w-full p-1 text-sm rounded border bg-background" placeholder="내용" />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* --- Modals --- */}

            {showFineModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">💰 벌금 상세 기록</h3>
                            <button onClick={() => setShowFineModal(false)}>✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-muted">
                                        <th className="border p-2">날짜</th>
                                        <th className="border p-2">금액</th>
                                        <th className="border p-2">이름</th>
                                        <th className="border p-2">비고</th>
                                        <th className="border p-2">삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fineRecords.map((r, i) => (
                                        <tr key={i}>
                                            <td className="border p-1"><input type="date" value={r.date} onChange={e => { const n = [...fineRecords]; n[i].date = e.target.value; setFineRecords(n) }} className="w-full bg-transparent" /></td>
                                            <td className="border p-1"><input type="number" value={r.amount} onChange={e => { const n = [...fineRecords]; n[i].amount = Number(e.target.value); setFineRecords(n) }} className="w-full bg-transparent" placeholder="0" /></td>
                                            <td className="border p-1">
                                                <select value={r.name} onChange={e => { const n = [...fineRecords]; n[i].name = e.target.value; setFineRecords(n) }} className="w-full bg-transparent">
                                                    <option value="">선택</option>
                                                    {mates.slice(0, userCount).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="border p-1"><input type="text" value={r.note} onChange={e => { const n = [...fineRecords]; n[i].note = e.target.value; setFineRecords(n) }} className="w-full bg-transparent" /></td>
                                            <td className="border p-1 text-center"><button onClick={() => setFineRecords(fineRecords.filter((_, idx) => idx !== i))} className="text-red-500">🗑️</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => setFineRecords([...fineRecords, { date: "", amount: 0, name: "", note: "" }])} className="mt-2 w-full py-2 bg-muted text-sm font-medium rounded">+ 추가</button>
                        </div>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">⚙️ 체크 항목 설정</h2>
                            <div className="flex gap-2">
                                {!isSettingsLocked ? (
                                    <button onClick={confirmSettings} className="px-3 py-1 bg-emerald-500 text-white rounded text-sm">✅ 확정</button>
                                ) : (
                                    <button onClick={handleEditClick} className="px-3 py-1 bg-amber-500 text-white rounded text-sm">
                                        ✏️ 수정 {editClickCount > 0 && `(${3 - editClickCount})`}
                                    </button>
                                )}
                                <button onClick={() => setShowSettingsModal(false)}>✕</button>
                            </div>
                        </div>

                        <div className="mb-4 flex items-center gap-2">
                            <span className="text-sm font-medium">항목 수:</span>
                            <select value={checkItemCount} onChange={e => setCheckItemCount(Number(e.target.value))} disabled={isSettingsLocked} className="border rounded p-1 text-sm">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}개</option>)}
                            </select>
                        </div>

                        {/* New Main Check Goal Setting */}
                        <div className="mb-4 p-3 border rounded-lg bg-blue-500/10">
                            <div className="flex items-center gap-4">
                                <span className="font-semibold text-sm">메이트 콜 & 체크(기본) 주간 목표:</span>
                                <select value={mainWeeklyGoal} onChange={e => setMainWeeklyGoal(Number(e.target.value))} disabled={isSettingsLocked} className="border rounded p-1 text-sm bg-background">
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}회</option>)}
                                </select>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">* 기본 진행 체크의 주간 달성 목표를 설정합니다. 미달성 시 붉은색으로 표시됩니다.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            {checkLabels.slice(0, checkItemCount).map((label, index) => (
                                <div key={index} className="p-3 border rounded-lg bg-muted/20">
                                    <input type="text" value={label} onChange={e => updateCheckLabel(index, e.target.value)} disabled={isSettingsLocked} className="w-full p-2 border rounded mb-2 text-sm bg-background" placeholder={`항목 ${index + 1}`} />
                                    <div className="flex justify-between items-center text-xs">
                                        <span>주간 목표</span>
                                        <select value={checkWeeklyCount[index]} onChange={e => updateCheckWeeklyCount(index, Number(e.target.value))} disabled={isSettingsLocked} className="border rounded p-0.5 bg-background text-foreground">
                                            {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}회</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showCalendarModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">📅 월별 현황</h2>
                            <button onClick={() => setShowCalendarModal(false)}>✕</button>
                        </div>
                        {renderCalendar()}
                    </div>
                </div>
            )}

            {showMateDetailModal && selectedMateIndex !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto p-6 relative">
                        <button onClick={() => setShowMateDetailModal(false)} className="absolute top-4 right-4">✕</button>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            👤 {mates[selectedMateIndex].name}님의 주간 활동 리포트
                        </h2>

                        <div className="p-4 bg-muted/30 rounded-lg mb-6 flex flex-col md:flex-row gap-4 justify-between items-center text-sm">
                            <div className="flex gap-4">
                                <span>메이트 넘버: <strong>{mates[selectedMateIndex].id}</strong></span>
                                <span>연락처: <strong>{mates[selectedMateIndex].contact}</strong></span>
                            </div>
                            <div className="text-muted-foreground">
                                {formatDate(getMondayOfWeek(new Date(selectedDate)))} ~ {formatDate(new Date(getMondayOfWeek(new Date(selectedDate)).getTime() + 6 * 24 * 60 * 60 * 1000))} (주간)
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="border p-2 text-left min-w-[100px]">체크 항목 / 요일</th>
                                        {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => {
                                            const monday = getMondayOfWeek(new Date(selectedDate));
                                            const date = new Date(monday);
                                            date.setDate(monday.getDate() + i);
                                            const dateStr = formatDate(date);
                                            const isToday = dateStr === formatDate(new Date(selectedDate));
                                            const isWeekend = i >= 5;
                                            return (
                                                <th key={day} className={`border p-2 text-center ${isToday ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}>
                                                    <span className={isWeekend ? 'text-red-500' : ''}>{day}</span>
                                                    <div className="text-xs text-muted-foreground font-normal mt-0.5">
                                                        {date.getDate()}일
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="border p-2 text-center bg-muted/30">주간 합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border p-3 font-medium bg-muted/20">진행 여부 체크</td>
                                        {Array.from({ length: 7 }, (_, i) => {
                                            const monday = getMondayOfWeek(new Date(selectedDate));
                                            const date = new Date(monday);
                                            date.setDate(monday.getDate() + i);
                                            const yyyymmdd = date.toISOString().split("T")[0];
                                            const isCurrentDate = yyyymmdd === selectedDate;
                                            const dayRecord = isCurrentDate
                                                ? progressRecords[selectedMateIndex]
                                                : dailyHistory[yyyymmdd]?.[selectedMateIndex];
                                            const isChecked = dayRecord ? dayRecord.progressCheck : false;
                                            return (
                                                <td key={i} className="border p-2 text-center">
                                                    {isChecked ? <span className="text-blue-500 text-lg">✅</span> : <span className="text-muted-foreground/20">-</span>}
                                                </td>
                                            );
                                        })}
                                        <td className="border p-2 text-center font-bold">
                                            {Array.from({ length: 7 }, (_, i) => {
                                                const d = new Date(getMondayOfWeek(new Date(selectedDate)));
                                                d.setDate(d.getDate() + i);
                                                const yyyymmdd = d.toISOString().split("T")[0];
                                                const isCurrentDate = yyyymmdd === selectedDate;
                                                const dayRecord = isCurrentDate ? progressRecords[selectedMateIndex] : dailyHistory[yyyymmdd]?.[selectedMateIndex];
                                                return dayRecord?.progressCheck;
                                            }).filter(Boolean).length}회
                                        </td>
                                    </tr>

                                    {checkLabels.slice(0, checkItemCount).map((label, checkIdx) => (
                                        <tr key={checkIdx}>
                                            <td className="border p-3 font-medium text-muted-foreground">{label}</td>
                                            {Array.from({ length: 7 }, (_, i) => {
                                                const monday = getMondayOfWeek(new Date(selectedDate));
                                                const date = new Date(monday);
                                                date.setDate(monday.getDate() + i);
                                                const yyyymmdd = date.toISOString().split("T")[0];
                                                const isCurrentDate = yyyymmdd === selectedDate;
                                                const dayRecord = isCurrentDate
                                                    ? progressRecords[selectedMateIndex]
                                                    : dailyHistory[yyyymmdd]?.[selectedMateIndex];
                                                const isChecked = dayRecord ? dayRecord.customChecks[checkIdx].checked : false;
                                                return (
                                                    <td key={i} className="border p-2 text-center">
                                                        {isChecked ? <span className="text-emerald-500 text-lg">🟩</span> : <span className="text-muted-foreground/20">.</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="border p-2 text-center font-bold">
                                                <span className={(() => {
                                                    const count = Array.from({ length: 7 }, (_, i) => {
                                                        const d = new Date(getMondayOfWeek(new Date(selectedDate)));
                                                        d.setDate(d.getDate() + i);
                                                        const yyyymmdd = d.toISOString().split("T")[0];
                                                        const isCurrentDate = yyyymmdd === selectedDate;
                                                        const dayRecord = isCurrentDate ? progressRecords[selectedMateIndex] : dailyHistory[yyyymmdd]?.[selectedMateIndex];
                                                        return dayRecord?.customChecks[checkIdx].checked;
                                                    }).filter(Boolean).length;
                                                    return count < checkWeeklyCount[checkIdx] ? "text-red-500" : "text-emerald-600";
                                                })()}>
                                                    {Array.from({ length: 7 }, (_, i) => {
                                                        const d = new Date(getMondayOfWeek(new Date(selectedDate)));
                                                        d.setDate(d.getDate() + i);
                                                        const yyyymmdd = d.toISOString().split("T")[0];
                                                        const isCurrentDate = yyyymmdd === selectedDate;
                                                        const dayRecord = isCurrentDate ? progressRecords[selectedMateIndex] : dailyHistory[yyyymmdd]?.[selectedMateIndex];
                                                        return dayRecord?.customChecks[checkIdx].checked;
                                                    }).filter(Boolean).length}
                                                </span>
                                                <span className="text-muted-foreground text-xs font-normal"> / {checkWeeklyCount[checkIdx]}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground text-right">
                            * 해당 주차에 데이터가 없는 날짜는 체크하지 않은 것으로 간주됩니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
