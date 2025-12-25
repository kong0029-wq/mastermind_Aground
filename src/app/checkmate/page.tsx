"use client";

import { Settings, Calendar as CalendarIcon, Save, Cloud, Loader2, Lock, Unlock, ArrowRight, UserCog, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getDashboardData, saveDashboardData, resetDashboardData, type CheckmateData } from "@/lib/checkmateService";

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

interface MateCallRecord {
    mateId: string;
    mateName: string;
    mateCallPartner: string;
    progressCheck: boolean;
}

interface HabitRecord {
    mateId: string;
    mateName: string;
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

const generateRandomPairs = (rowCount: number, poolSize: number, seed: number): { callerIdx: number, partnerIdx: number }[] => {
    if (poolSize === 0) return Array(rowCount).fill({ callerIdx: -1, partnerIdx: -1 });

    // 1. Generate a pool ensuring every active user appears at least once (if slots allow)
    const allIndices = Array.from({ length: poolSize }, (_, i) => i);

    // First batch: Guaranteed users (shuffled)
    const guaranteed = seededShuffle(allIndices, seed);

    // Fill up to total slots (rowCount * 2)
    const totalSlots = rowCount * 2;
    const finalPool = [...guaranteed];

    let extraSeed = seed;
    while (finalPool.length < totalSlots) {
        extraSeed += 541; // Arbitrary increment for variety
        const nextBatch = seededShuffle(allIndices, extraSeed);
        finalPool.push(...nextBatch);
    }

    // Trim to exact size required
    const slots = finalPool.slice(0, totalSlots);

    // 2. Shuffle the assigned slots to mix Callers and Partners randomly
    const shuffledSlots = seededShuffle(slots, seed + 9999);

    const pairs: { callerIdx: number, partnerIdx: number }[] = [];
    for (let i = 0; i < rowCount; i++) {
        pairs.push({
            callerIdx: shuffledSlots[i * 2],
            partnerIdx: shuffledSlots[i * 2 + 1]
        });
    }

    // 3. Conflict Resolution: Prevent Self-Matching (Caller === Partner)
    // We try to swap partner with the next row's partner if a conflict exists.
    if (poolSize > 1) {
        for (let i = 0; i < rowCount; i++) {
            if (pairs[i].callerIdx === pairs[i].partnerIdx) {
                const nextRow = (i + 1) % rowCount;
                // Swap partners
                const temp = pairs[i].partnerIdx;
                pairs[i].partnerIdx = pairs[nextRow].partnerIdx;
                pairs[nextRow].partnerIdx = temp;

                // If the swap caused a conflict in the next row, continue loop to resolve it there
                // (Simple adjacent swap strategy usually resolves sparse conflicts)
            }
        }
    }

    return pairs;
};

const createDefaultLabels = (count: number): string[] => {
    const defaultNames = ["스레드 작성", "칼럼 작성", "저널링 작성", "가계부 작성"];
    return Array.from({ length: count }, (_, i) =>
        i < defaultNames.length ? defaultNames[i] : `항목 ${i + 1}`
    );

};

// NEW: Get Mon-Fri dates for a specific week
const getDatesOfWeek = (currentDate: string): string[] => {
    const date = new Date(currentDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(date.setDate(diff));

    const weekDates = [];
    for (let i = 0; i < 5; i++) { // Mon to Fri (5 days)
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(formatDate(d).replace(/\./g, "-")); // YYYY-MM-DD
    }
    return weekDates;
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
    const [isMatchingLocked, setIsMatchingLocked] = useState<boolean>(true); // NEW: Lock State for Mate Matching
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
    // Separate History
    const [mateHistory, setMateHistory] = useState<Record<string, MateCallRecord[]>>({});
    const [habitHistory, setHabitHistory] = useState<Record<string, HabitRecord[]>>({});

    // Current View Data
    const [currentMateRecords, setCurrentMateRecords] = useState<MateCallRecord[]>(() =>
        Array.from({ length: 10 }, (_, i) => ({
            mateId: String.fromCharCode(65 + i),
            mateName: "",
            mateCallPartner: "",
            progressCheck: false
        }))
    );
    const [currentHabitRecords, setCurrentHabitRecords] = useState<HabitRecord[]>(() =>
        Array.from({ length: 10 }, (_, i) => ({
            mateId: String.fromCharCode(65 + i),
            mateName: "",
            customChecks: Array.from({ length: 10 }, (_, idx) => ({
                id: `check-${idx}`,
                label: createDefaultLabels(10)[idx],
                checked: false,
            })),
            note: ""
        }))
    );

    // 4. New Features State
    const [bankInfo, setBankInfo] = useState<string>("");
    const [fineNotice, setFineNotice] = useState<string>("");
    const fineNoticeRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize Fine Notice Textarea
    useEffect(() => {
        if (fineNoticeRef.current) {
            fineNoticeRef.current.style.height = "auto";
            fineNoticeRef.current.style.height = fineNoticeRef.current.scrollHeight + "px";
        }
    }, [fineNotice]);

    // 5. Modal State
    const [showFineModal, setShowFineModal] = useState<boolean>(false);
    const [showMateDetailModal, setShowMateDetailModal] = useState<boolean>(false);
    const [selectedMateIndex, setSelectedMateIndex] = useState<number | null>(null);
    const [showCheckDetailModal, setShowCheckDetailModal] = useState<boolean>(false);
    const [selectedCheckIndex, setSelectedCheckIndex] = useState<number | null>(null);

    const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
    const [showWeeklyHabitModal, setShowWeeklyHabitModal] = useState<boolean>(false);
    const [habitModalScale, setHabitModalScale] = useState(0.8);
    const [showFineAccumulationModal, setShowFineAccumulationModal] = useState<boolean>(false);

    // Manager Mode State
    const [showManagerModal, setShowManagerModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState<string>("");
    const [inputPassword, setInputPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isFineSectionLocked, setIsFineSectionLocked] = useState(true);
    const [modalScale, setModalScale] = useState(1.0);
    const [allowPastDateEdit, setAllowPastDateEdit] = useState(false);


    // --- Persistence Logic ---

    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');

    // Load from Supabase (Primary) or LocalStorage (Fallback)
    useEffect(() => {
        const loadData = async () => {
            setIsInitialized(false);

            // Try fetching from Supabase
            const cloudData = await getDashboardData();

            let parsed: any = cloudData;

            if (!parsed) {
                // Fallback to local storage if no cloud data
                const localData = localStorage.getItem("checkmate_v2_data");
                if (localData) {
                    try {
                        parsed = JSON.parse(localData);
                    } catch (e) {
                        // Failed to parse local data
                    }
                }
            }

            if (parsed) {
                // Enforce 4 users (A, B, C, D) by ignoring stored userCount
                if (parsed.userCount) setUserCount(parsed.userCount);
                // setUserCount(4); // Removed forced enforcement

                if (parsed.checkItemCount) setCheckItemCount(parsed.checkItemCount);
                if (parsed.checkLabels) setCheckLabels(parsed.checkLabels);
                if (parsed.checkWeeklyCount) setCheckWeeklyCount(parsed.checkWeeklyCount);
                if (parsed.mainWeeklyGoal) setMainWeeklyGoal(parsed.mainWeeklyGoal);
                if (parsed.isSettingsLocked !== undefined) setIsSettingsLocked(parsed.isSettingsLocked);
                if (parsed.isUserInfoLocked !== undefined) setIsUserInfoLocked(parsed.isUserInfoLocked);
                if (parsed.mates) setMates(parsed.mates);
                if (parsed.fineRecords) setFineRecords(parsed.fineRecords);

                // --- DATA MIGRATION & LOADING ---
                let loadedMateHistory: Record<string, MateCallRecord[]> = parsed.mateHistory || {};
                let loadedHabitHistory: Record<string, HabitRecord[]> = parsed.habitHistory || {};

                // Move legacy dailyHistory to new separate histories if needed
                if (parsed.dailyHistory && Object.keys(loadedMateHistory).length === 0 && Object.keys(loadedHabitHistory).length === 0) {
                    Object.entries(parsed.dailyHistory).forEach(([date, records]: [string, any]) => {
                        loadedMateHistory[date] = records.map((r: any) => ({
                            mateId: r.mateId,
                            mateName: r.mateName,
                            mateCallPartner: r.mateCallPartner,
                            progressCheck: r.progressCheck
                        }));
                        loadedHabitHistory[date] = records.map((r: any) => ({
                            mateId: r.mateId,
                            mateName: r.mateName,
                            customChecks: r.customChecks,
                            note: r.note
                        }));
                    });
                }

                setMateHistory(loadedMateHistory);
                setHabitHistory(loadedHabitHistory);

                const today = new Date().toISOString().split("T")[0];

                // Initialize Current Views
                if (loadedMateHistory[today]) setCurrentMateRecords(loadedMateHistory[today]);
                if (loadedHabitHistory[today]) setCurrentHabitRecords(loadedHabitHistory[today]);

                if (parsed.bankInfo) setBankInfo(parsed.bankInfo);
                if (parsed.fineNotice) setFineNotice(parsed.fineNotice);
                if (parsed.adminPassword) setAdminPassword(parsed.adminPassword); // NEW: Load admin password
            }
            setIsInitialized(true);
        };

        loadData();
    }, []);

    // Save to Supabase (Debounced)
    useEffect(() => {
        if (!isInitialized) return;

        setSaveStatus('unsaved');
        const timer = setTimeout(async () => {
            setSaveStatus('saving');

            // Sync current view to history for saving
            const historyToSaveMate = { ...mateHistory, [selectedDate]: currentMateRecords };
            const historyToSaveHabit = { ...habitHistory, [selectedDate]: currentHabitRecords };

            const dataToSave: CheckmateData = {
                userCount,
                checkItemCount,
                checkLabels,
                checkWeeklyCount,
                mainWeeklyGoal,
                isSettingsLocked,
                isUserInfoLocked,
                mates,
                fineRecords,
                mateHistory: historyToSaveMate,
                habitHistory: historyToSaveHabit,
                bankInfo,
                fineNotice,
                adminPassword // NEW: Save admin password
            };

            // Save to LocalStorage as backup
            localStorage.setItem("checkmate_v2_data", JSON.stringify(dataToSave));

            // Save to Supabase
            const success = await saveDashboardData(dataToSave);
            setSaveStatus(success ? 'saved' : 'error');
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timer);
    }, [
        userCount, checkItemCount, checkLabels, checkWeeklyCount, mainWeeklyGoal, isSettingsLocked, isUserInfoLocked,
        mates, fineRecords, mateHistory, habitHistory, currentMateRecords, currentHabitRecords, selectedDate, bankInfo, fineNotice, adminPassword, isInitialized
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

            let records: MateCallRecord[] | undefined;
            if (dStr === selectedDate) {
                records = currentMateRecords;
            } else {
                records = mateHistory[dStr];
            }

            if (records) {
                const userRecord = records.find(r => r.mateId === mateId);
                if (userRecord && userRecord.progressCheck) {
                    count++;
                }
            }
        }
        return count;
    }, [mateHistory, currentMateRecords, selectedDate]);

    const totalFine = useMemo(() => {
        return fineRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
    }, [fineRecords]);

    // 날짜 변경 핸들러
    const handleDateChange = (newDate: string) => {
        // Save current view to history before switching
        const updatedMateHistory = { ...mateHistory, [selectedDate]: currentMateRecords };
        const updatedHabitHistory = { ...habitHistory, [selectedDate]: currentHabitRecords };

        setMateHistory(updatedMateHistory);
        setHabitHistory(updatedHabitHistory);

        setSelectedDate(newDate);

        // Load or Initialize Mate Records for New Date
        if (updatedMateHistory[newDate]) {
            setCurrentMateRecords(updatedMateHistory[newDate]);
        } else {
            // New Mate Records (Fixed 4 Rows)
            const weekNumber = getWeekNumber(new Date(newDate));
            const yearSeed = new Date(newDate).getFullYear() * 100 + weekNumber;
            // [FIX] Use generateRandomPairs for Caller & Partner
            const matching = generateRandomPairs(4, userCount, yearSeed);

            const newMates = Array.from({ length: 4 }, (_, i) => ({ // Fixed 4
                mateId: String(i + 1), // Numeric IDs 1-4
                mateName: "",
                mateCallPartner: "",
                progressCheck: false
            }));

            for (let i = 0; i < 4; i++) {
                const { callerIdx, partnerIdx } = matching[i];

                // 1. Set Caller (Random)
                if (callerIdx >= 0 && callerIdx < userCount && mates[callerIdx]) {
                    newMates[i].mateName = mates[callerIdx].name;
                }

                // 2. Set Partner (Random)
                if (partnerIdx >= 0 && partnerIdx < userCount && mates[partnerIdx]) {
                    newMates[i].mateCallPartner = mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`;
                }
            }
            setCurrentMateRecords(newMates);
        }

        // Load or Initialize Habit Records for New Date
        if (updatedHabitHistory[newDate]) {
            setCurrentHabitRecords(updatedHabitHistory[newDate]);
        } else {
            const newHabits = Array.from({ length: 10 }, (_, i) => ({
                mateId: String.fromCharCode(65 + i),
                mateName: mates[i].name,
                customChecks: checkLabels.map((label, idx) => ({
                    id: `check-${idx}`,
                    label: label,
                    checked: false
                })),
                note: ""
            }));
            setCurrentHabitRecords(newHabits);
        }
    };

    const applyRandomMatching = () => {
        const weekNumber = getWeekNumber(new Date(selectedDate)); // [FIX] Restore weekNumber
        const yearSeed = new Date(selectedDate).getFullYear() * 100 + weekNumber;
        const randomSeed = yearSeed + Math.floor(Math.random() * 10000);
        // [FIX] Use generateRandomPairs for Caller & Partner
        const matching = generateRandomPairs(4, userCount, randomSeed);

        // Prepare new record structure
        const newRecordBase = Array.from({ length: 4 }, (_, i) => {
            const { callerIdx, partnerIdx } = matching[i];
            return {
                mateId: String(i + 1),
                mateName: (callerIdx >= 0 && callerIdx < userCount && mates[callerIdx]) ? mates[callerIdx].name : "",
                mateCallPartner: (partnerIdx >= 0 && partnerIdx < userCount && mates[partnerIdx]) ? (mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`) : "",
                progressCheck: false // Default, will be preserved from history if exists
            };
        });

        // Update Mate Records for ALL days in the current week
        const weekDates = getDatesOfWeek(selectedDate);

        // We need to update mateHistory directly to propagate changes
        setMateHistory(prevHistory => {
            const newHistory = { ...prevHistory };

            weekDates.forEach(dateStr => {
                const existingRecords = newHistory[dateStr] || [];

                // create new records for this date, preserving progressCheck if it existed
                const updatedRecords = newRecordBase.map((baseRecord, index) => {
                    const existingRecord = existingRecords[index];
                    return {
                        ...baseRecord,
                        progressCheck: existingRecord ? existingRecord.progressCheck : false
                    };
                });

                newHistory[dateStr] = updatedRecords;
            });

            // Update currentMateRecords to reflect the change immediately
            setCurrentMateRecords(newHistory[selectedDate]);

            return newHistory;
        });
    };

    // Initial Random Matching (useEffect refactor)
    useEffect(() => {
        if (isInitialized) {
            // Check if we already have records for selectedDate
            if (mateHistory[selectedDate]) return;

            // Check if any other day in the same week has records to inherit from
            const weekDates = getDatesOfWeek(selectedDate);
            const siblingDate = weekDates.find(date => mateHistory[date]);

            if (siblingDate) {
                // Inherit matching from sibling
                const siblingRecords = mateHistory[siblingDate];
                const inheritedRecords = siblingRecords.map(record => ({
                    ...record,
                    progressCheck: false // Reset progress for the new day
                }));
                setCurrentMateRecords(inheritedRecords);
            } else {
                // No sibling data, generate new
                const weekNumber = getWeekNumber(new Date(selectedDate));
                const yearSeed = new Date(selectedDate).getFullYear() * 100 + weekNumber;
                // [FIX] Use generateRandomPairs for Caller & Partner
                const matching = generateRandomPairs(4, userCount, yearSeed);

                const newRecords = Array.from({ length: 4 }, (_, i) => {
                    const { callerIdx, partnerIdx } = matching[i];
                    return {
                        mateId: String(i + 1),
                        mateName: (callerIdx >= 0 && callerIdx < userCount && mates[callerIdx]) ? mates[callerIdx].name : "",
                        mateCallPartner: (partnerIdx >= 0 && partnerIdx < userCount && mates[partnerIdx]) ? (mates[partnerIdx].name || `메이트 ${String.fromCharCode(65 + partnerIdx)}`) : "",
                        progressCheck: false
                    };
                });

                setCurrentMateRecords(newRecords);
            }
        }
    }, [userCount, isInitialized, selectedDate]); // Added selectedDate to deps to ensure check logic runs on init

    // --- UI Update Helpers ---

    const updateMateInfo = (index: number, field: keyof MateInfo, value: string) => {
        const newMates = [...mates];
        newMates[index] = { ...newMates[index], [field]: value };
        setMates(newMates);
        if (field === "name") {
            // Update names in both records
            setCurrentMateRecords(prev => {
                const n = [...prev];
                n[index] = { ...n[index], mateName: value };
                return n;
            });
            setCurrentHabitRecords(prev => {
                const n = [...prev];
                n[index] = { ...n[index], mateName: value };
                return n;
            });
        }
    };

    // Renamed & Split: Update Mate Call Record
    const updateMateCallRecord = (index: number, field: keyof MateCallRecord, value: any) => {
        const newRecords = [...currentMateRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setCurrentMateRecords(newRecords);
        setMateHistory(prev => ({ ...prev, [selectedDate]: newRecords }));
    };

    // Renamed & Split: Update Habit Record (Note)
    const updateHabitRecord = (index: number, field: keyof HabitRecord, value: any) => {
        const newRecords = [...currentHabitRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setCurrentHabitRecords(newRecords);
        setHabitHistory(prev => ({ ...prev, [selectedDate]: newRecords }));
    };

    const updateCustomCheck = (mateIndex: number, checkIndex: number, checked: boolean) => {
        const newRecords = [...currentHabitRecords];
        const newChecks = [...newRecords[mateIndex].customChecks];
        newChecks[checkIndex] = { ...newChecks[checkIndex], checked };
        newRecords[mateIndex] = { ...newRecords[mateIndex], customChecks: newChecks };
        setCurrentHabitRecords(newRecords);
        setHabitHistory(prev => ({ ...prev, [selectedDate]: newRecords }));
    };

    const toggleWeeklyMateCheck = (index: number, dateStr: string) => {
        if (dateStr === selectedDate) {
            const newRecords = [...currentMateRecords];
            if (newRecords[index]) {
                newRecords[index] = { ...newRecords[index], progressCheck: !newRecords[index].progressCheck };
                setCurrentMateRecords(newRecords);
                setMateHistory(prev => ({ ...prev, [selectedDate]: newRecords }));
            }
        } else {
            setMateHistory(prev => {
                let dayRecords = prev[dateStr];

                // If records for this day don't exist, initialize them from current mates list
                if (!dayRecords) {
                    dayRecords = mates.map(m => ({
                        mateId: m.id,
                        mateName: m.name,
                        mateCallPartner: "",
                        progressCheck: false
                    }));
                } else {
                    dayRecords = [...dayRecords];
                }

                if (dayRecords[index]) {
                    dayRecords[index] = { ...dayRecords[index], progressCheck: !dayRecords[index].progressCheck };
                    return { ...prev, [dateStr]: dayRecords };
                }
                return prev;
            });
        }
    };

    const updateCheckLabel = (index: number, newLabel: string) => {
        const newLabels = [...checkLabels];
        newLabels[index] = newLabel;
        setCheckLabels(newLabels);
        setCurrentHabitRecords(prev => prev.map(record => ({
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

    const confirmUserInfo = () => {
        setIsUserInfoLocked(true);
        setUserInfoEditClickCount(0);
        applyRandomMatching(); // Trigger matching with new user count
    };
    const handleUserInfoEditClick = () => {
        if (!isManagerAuthenticated) {
            alert("관리자 권한이 필요합니다.");
            setShowManagerModal(true);
            return;
        }

        if (userInfoEditClickCount < 3) {
            setIsUserInfoLocked(false);
            setUserInfoEditClickCount(prev => prev + 1);
        } else {
            alert("수정 횟수를 초과했습니다. 관리자에게 문의하세요.");
        }
    };

    const copyCurrentDayToWeek = () => {
        if (!confirm("현재 날짜의 이름과 메이트 정보를 이번 주 전체에 복사하시겠습니까?\n기존 데이터는 덮어씌워집니다.")) {
            return;
        }

        const weekDates = getDatesOfWeek(selectedDate);
        const currentData = currentMateRecords.slice(0, 4);

        setMateHistory(prev => {
            const updated = { ...prev };
            weekDates.forEach(dateStr => {
                updated[dateStr] = currentData.map(record => ({
                    mateId: record.mateId,
                    mateName: record.mateName,
                    mateCallPartner: record.mateCallPartner,
                    progressCheck: prev[dateStr]?.[currentData.indexOf(record)]?.progressCheck || false
                }));
            });
            return updated;
        });
    };

    // --- Helper function to get dates of the week (Mon-Sun) ---
    const getDatesOfWeek = (dateStr: string): string[] => {
        const date = new Date(dateStr);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const current = new Date(monday);
            current.setDate(monday.getDate() + i);
            dates.push(current.toISOString().split('T')[0]);
        }
        return dates;
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
            // Check existence in either history
            const hasData = !!mateHistory[dateStr] || !!habitHistory[dateStr];

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
                        const validDay = week.find(d => d !== null);
                        if (validDay) {
                            const monday = getMondayOfWeek(new Date(validDay.dateStr));
                            for (let i = 0; i < 7; i++) {
                                const d = new Date(monday);
                                d.setDate(d.getDate() + i);
                                const dStr = formatDate(d).replace(/\./g, '-');

                                let records: MateCallRecord[] | undefined;
                                if (dStr === selectedDate) records = currentMateRecords;
                                else records = mateHistory[dStr];

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
                                {week.map((dayInfo, dIdx) => {
                                    // Calculate daily missed for this specific day
                                    const dailyMissed: string[] = [];
                                    if (dayInfo && dayInfo.hasData) {
                                        let records = mateHistory[dayInfo.dateStr];
                                        if (dayInfo.dateStr === selectedDate) records = currentMateRecords;

                                        if (records) {
                                            // Check only active rows (0 to 3)
                                            records.slice(0, 4).forEach(r => {
                                                if (r.mateName && !r.progressCheck) {
                                                    dailyMissed.push(r.mateName);
                                                }
                                            });
                                        }
                                    }

                                    return (
                                        <div
                                            key={dIdx}
                                            className={`p-2 rounded-lg text-sm min-h-[60px] flex flex-col items-center justify-start border
                                            ${!dayInfo ? 'invisible' : ''}
                                            ${dayInfo?.dateStr === selectedDate ? 'ring-2 ring-blue-500' : ''}
                                            ${dayInfo?.hasData ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-muted/30 border-border'}
                                            cursor-pointer hover:bg-muted/50
                                        `}
                                            onClick={() => dayInfo && handleDateChange(dayInfo.dateStr)}
                                        >
                                            <span className="font-semibold">{dayInfo?.day}</span>

                                            {/* Daily Missed Users Display */}
                                            {dailyMissed.length > 0 && (
                                                <div className="mt-1 flex flex-wrap justify-center gap-0.5 w-full">
                                                    {dailyMissed.map((name, i) => (
                                                        <span key={i} className="text-[10px] text-red-600 bg-red-100 dark:bg-red-900/30 px-1 rounded truncate max-w-full">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Removed weekly summary to prioritize daily cell display */}
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
                        {/* Status Indicator */}
                        <span className="ml-4 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted/50 border border-border">
                            {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-blue-500" /> 저장 중...</>}
                            {saveStatus === 'saved' && <><Cloud className="w-3 h-3 text-emerald-500" /> 저장됨</>}
                            {saveStatus === 'unsaved' && <><span className="w-2 h-2 rounded-full bg-amber-500" /> 변경사항 있음</>}
                            {saveStatus === 'error' && <><span className="w-2 h-2 rounded-full bg-red-500" /> 저장 실패</>}
                        </span>
                    </p>
                </div>

            </header>

            {/* Manager Mode Button */}
            <div className="absolute top-4 right-4 md:right-8">
                <button
                    onClick={() => {
                        setShowManagerModal(true);
                        setInputPassword("");
                        setNewPassword("");
                        setIsManagerAuthenticated(false);
                        setShowResetConfirm(false);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-full hover:bg-slate-700 transition"
                >
                    <UserCog className="w-3 h-3" />
                    관리자
                </button>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <section className="bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">👥</span>
                            사용자 정보 입력
                        </h2>

                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10">
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">번호</th>
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">이름</th>
                                    <th className="border border-border px-4 py-2 text-left text-sm font-semibold">연락처</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mates.slice(0, userCount).map((mate, index) => (
                                    <tr key={mate.id} className="hover:bg-muted/30">
                                        <td className="border border-border px-4 py-2 text-center text-sm">{mate.id}</td>
                                        <td className="border border-border px-2 py-2">
                                            <input type="text" value={mate.name} onChange={(e) => updateMateInfo(index, "name", e.target.value)} placeholder="이름" disabled={isUserInfoLocked} className="w-full px-2 py-1 text-sm rounded border bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 disabled:opacity-50" />
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
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowFineAccumulationModal(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:opacity-90 font-medium text-sm"
                                >
                                    📊 누적 현황
                                </button>
                                <button
                                    onClick={() => setShowFineModal(true)}
                                    disabled={isFineSectionLocked}
                                    className={`px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:opacity-90 font-medium text-sm ${isFineSectionLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    📋 상세 / 추가
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">🏦 벌금 입금 계좌</label>
                                <input
                                    type="text"
                                    value={bankInfo}
                                    onChange={(e) => setBankInfo(e.target.value)}
                                    placeholder="예: 카카오뱅크 1234-56-7890 홍길동"
                                    disabled={isFineSectionLocked}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-50 disabled:bg-muted"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">📢 벌금 안내 / 메모</label>
                                <textarea
                                    ref={fineNoticeRef}
                                    value={fineNotice}
                                    onChange={(e) => setFineNotice(e.target.value)}
                                    placeholder="벌금 관련 공지사항이나 규칙을 자유롭게 적어주세요."
                                    rows={1}
                                    disabled={isFineSectionLocked}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-amber-500 transition-all resize-none overflow-hidden disabled:opacity-50 disabled:bg-muted"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div >

            {/* --- Section 1: Mate Call Status --- */}
            < section className="max-w-7xl mx-auto bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6 mb-6" >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">📞</span>
                            메이트 콜 현황
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

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap w-[12.5%]">번호</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap w-[12.5%]">이름</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap w-[12.5%]">메이트 (랜덤 매칭)</th>
                                {(() => {
                                    const formatHeaderDate = (dateStr: string) => {
                                        const d = new Date(dateStr);
                                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                                        return `${days[d.getDay()]} (${d.getMonth() + 1}.${d.getDate()})`;
                                    };
                                    return (
                                        <th className="border border-border px-3 py-2 text-center text-sm font-semibold w-[25%]">
                                            {formatHeaderDate(selectedDate)}
                                        </th>
                                    );
                                })()}
                            </tr>
                        </thead>
                        <tbody>
                            {currentMateRecords.slice(0, 4).map((record, index) => {
                                const weekDates = getDatesOfWeek(selectedDate);
                                return (
                                    <tr key={`mate-${record.mateId}`} className="hover:bg-muted/30">
                                        <td className="border border-border px-3 py-2 text-center text-muted-foreground">{record.mateId}</td>
                                        <td className="border border-border px-2 py-2 text-center">
                                            <input
                                                type="text"
                                                value={record.mateName}
                                                onChange={(e) => updateMateCallRecord(index, "mateName", e.target.value)}
                                                disabled={isMatchingLocked}
                                                className={`w-full p-1 text-sm rounded border text-center font-medium transition-colors ${isMatchingLocked
                                                    ? "bg-muted/10 text-foreground border-transparent cursor-pointer"
                                                    : "bg-background border-border focus:ring-2 focus:ring-blue-500"
                                                    }`}
                                                onClick={isMatchingLocked ? () => { setSelectedMateIndex(index); setShowMateDetailModal(true); } : undefined}
                                                placeholder="이름"
                                            />
                                        </td>
                                        <td className="border border-border px-2 py-2 text-center">
                                            <input
                                                type="text"
                                                value={record.mateCallPartner}
                                                onChange={(e) => updateMateCallRecord(index, "mateCallPartner", e.target.value)}
                                                disabled={isMatchingLocked}
                                                className={`w-full p-1 text-sm rounded border text-center transition-colors ${isMatchingLocked
                                                    ? "bg-muted/10 text-muted-foreground border-transparent"
                                                    : "bg-background border-border focus:ring-2 focus:ring-blue-500"
                                                    }`}
                                                placeholder="직접 입력"
                                            />
                                        </td>
                                        {/* Selected Date's Check */}
                                        {(() => {
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const isChecked = mateHistory[selectedDate]?.[index]?.progressCheck || false;
                                            return (
                                                <td className="border border-border px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleWeeklyMateCheck(index, selectedDate)}
                                                        disabled={!allowPastDateEdit && selectedDate !== todayStr}
                                                        className="w-5 h-5 accent-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    />
                                                </td>
                                            );
                                        })()}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section >

            {/* --- Section 2: Habit Check Status --- */}
            < section className="max-w-7xl mx-auto bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6" >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">✅</span>
                            습관 체크 현황
                            <span className="text-base font-normal text-muted-foreground ml-2">
                                ({formatDate(getMondayOfWeek(new Date(selectedDate)))} ~ {formatDate(new Date(getMondayOfWeek(new Date(selectedDate)).getTime() + 6 * 24 * 60 * 60 * 1000))})
                            </span>
                        </h2>
                        <button
                            onClick={() => setShowWeeklyHabitModal(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 text-sm font-medium transition-colors"
                        >
                            <CalendarIcon className="w-4 h-4" />
                            주별 현황
                        </button>
                    </div>


                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-foreground">날짜:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <span className="text-sm text-muted-foreground">
                            * 사용자 정보와 연동됩니다.
                        </span>
                    </div>
                </div>

                <div className="text-sm text-foreground mb-3 p-3 bg-emerald-500/10 rounded-lg space-y-1">
                    <div className="flex flex-wrap gap-x-4">
                        <span>📅 <strong>{getWeekNumber(new Date(selectedDate))}주차</strong> 현황</span>
                        <span className="text-muted-foreground">| 설정 아이콘(⚙️)을 눌러 체크 항목의 이름을 변경할 수 있습니다.</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap w-[50px]">번호</th>
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap w-[100px]">이름</th>
                                {checkLabels.slice(0, checkItemCount).map((label, idx) => (
                                    <th key={idx} className="border border-border px-3 py-2 text-center text-sm font-semibold whitespace-nowrap bg-emerald-500/5 w-[100px]">
                                        {label}<br /><span className="text-xs font-normal">({checkWeeklyCount[idx]}회)</span>
                                    </th>
                                ))}
                                <th className="border border-border px-3 py-2 text-center text-sm font-semibold w-[200px]">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentHabitRecords.slice(0, userCount).map((record, index) => {
                                return (
                                    <tr key={`habit-${record.mateId}`} className="hover:bg-muted/30">
                                        <td className="border border-border px-3 py-2 text-center">{record.mateId}</td>
                                        <td onClick={() => { setSelectedMateIndex(index); setShowMateDetailModal(true); }} className="border border-border px-3 py-2 text-center font-medium bg-muted/20 text-black dark:text-white cursor-pointer hover:text-blue-500 hover:underline">{mates[index]?.name}</td>
                                        {record.customChecks.slice(0, checkItemCount).map((check, checkIdx) => (
                                            <td key={check.id} className="border border-border px-2 py-2 text-center bg-emerald-500/5">
                                                <input type="checkbox" checked={check.checked} onChange={e => updateCustomCheck(index, checkIdx, e.target.checked)} disabled={!allowPastDateEdit && selectedDate !== new Date().toISOString().split('T')[0]} className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                                            </td>
                                        ))}
                                        <td className="border border-border px-2 py-2">
                                            <input type="text" value={record.note} onChange={e => updateHabitRecord(index, "note", e.target.value)} className="w-full p-1 text-sm rounded border bg-background" placeholder="메모..." />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section >

            {/* --- Modals --- */}

            {
                showFineModal && (
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
                )
            }

            {
                showCalendarModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
                        <div
                            className="bg-card rounded-2xl shadow-xl w-full p-6 transition-all duration-200"
                            style={{ maxWidth: `${48 * modalScale}rem`, width: '100%' }}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    📅 월별 현황
                                    <div className="flex items-center gap-1 ml-4">
                                        <button
                                            onClick={() => setModalScale(prev => Math.max(0.8, prev - 0.1))}
                                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80"
                                            title="축소"
                                        >
                                            -
                                        </button>
                                        <span className="text-xs font-normal text-muted-foreground w-8 text-center">{Math.round(modalScale * 100)}%</span>
                                        <button
                                            onClick={() => setModalScale(prev => Math.min(2.0, prev + 0.1))}
                                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80"
                                            title="확대"
                                        >
                                            +
                                        </button>
                                    </div>
                                </h2>
                                <button onClick={() => setShowCalendarModal(false)}>✕</button>
                            </div>
                            {renderCalendar()}
                        </div>
                    </div>
                )
            }

            {
                showMateDetailModal && selectedMateIndex !== null && (
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
                                                    ? currentMateRecords[selectedMateIndex]
                                                    : mateHistory[yyyymmdd]?.[selectedMateIndex];
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
                                                    const dayRecord = isCurrentDate ? currentMateRecords[selectedMateIndex] : mateHistory[yyyymmdd]?.[selectedMateIndex];
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
                                                        ? currentHabitRecords[selectedMateIndex]
                                                        : habitHistory[yyyymmdd]?.[selectedMateIndex];
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
                                                            const dayRecord = isCurrentDate ? currentHabitRecords[selectedMateIndex] : habitHistory[yyyymmdd]?.[selectedMateIndex];
                                                            return dayRecord?.customChecks[checkIdx].checked;
                                                        }).filter(Boolean).length;
                                                        return count < checkWeeklyCount[checkIdx] ? "text-red-500" : "text-emerald-600";
                                                    })()}>
                                                        {Array.from({ length: 7 }, (_, i) => {
                                                            const d = new Date(getMondayOfWeek(new Date(selectedDate)));
                                                            d.setDate(d.getDate() + i);
                                                            const yyyymmdd = d.toISOString().split("T")[0];
                                                            const isCurrentDate = yyyymmdd === selectedDate;
                                                            const dayRecord = isCurrentDate ? currentHabitRecords[selectedMateIndex] : habitHistory[yyyymmdd]?.[selectedMateIndex];
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
                )
            }

            {/* Manager Modal */}
            {showManagerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">🛠️ 관리자 모드</h2>
                            <button onClick={() => setShowManagerModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                        </div>

                        {!adminPassword ? (
                            // Scenario 1: Set New Password
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm rounded-lg mb-4">
                                    초기 관리자 비밀번호가 설정되지 않았습니다.<br />
                                    새로운 비밀번호를 설정해주세요.
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">새 비밀번호 설정</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="flex-1 p-2 border rounded bg-background"
                                            placeholder="비밀번호 입력"
                                        />
                                        <button
                                            onClick={() => {
                                                if (newPassword.trim().length < 4) {
                                                    alert("비밀번호는 4자리 이상이어야 합니다.");
                                                    return;
                                                }
                                                setAdminPassword(newPassword);
                                                setIsManagerAuthenticated(true);
                                                alert("관리자 비밀번호가 설정되었습니다.");
                                            }}
                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : !isManagerAuthenticated ? (
                            // Scenario 2: Enter Password
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">관리자 비밀번호 입력</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={inputPassword}
                                            onChange={(e) => setInputPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (inputPassword === adminPassword) {
                                                        setIsManagerAuthenticated(true);
                                                    } else {
                                                        alert("비밀번호가 일치하지 않습니다.");
                                                    }
                                                }
                                            }}
                                            className="flex-1 p-2 border rounded bg-background"
                                            placeholder="비밀번호"
                                        />
                                        <button
                                            onClick={() => {
                                                if (inputPassword === adminPassword) {
                                                    setIsManagerAuthenticated(true);
                                                } else {
                                                    alert("비밀번호가 일치하지 않습니다.");
                                                }
                                            }}
                                            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
                                        >
                                            확인
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Admin Panel
                            <div className="space-y-6">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm rounded-lg flex items-center gap-2">
                                    <Unlock className="w-4 h-4" />
                                    관리자 권한으로 접속 중입니다.
                                </div>

                                {/* Check Items Configuration */}
                                <div className="border-t pt-6">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        체크 항목 설정
                                    </h3>

                                    <div className="space-y-4">
                                        {/* 1. 사용자 정보 입력 */}
                                        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <span className="text-base">1. 사용자 정보 입력</span>
                                            </h4>
                                            <div className="space-y-3 pl-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium">사용자 수 설정</label>
                                                    <select
                                                        value={userCount}
                                                        onChange={(e) => setUserCount(Number(e.target.value))}
                                                        className="px-2 py-1 text-sm rounded border bg-background"
                                                    >
                                                        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                                                            <option key={num} value={num}>{num}명</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isUserInfoLocked ? <Lock className="w-4 h-4 text-blue-600" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                                                        <span className="text-sm font-medium">사용자 정보 잠금</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsUserInfoLocked(!isUserInfoLocked)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isUserInfoLocked ? 'bg-blue-500' : 'bg-input'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isUserInfoLocked ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. 벌금 현황 및 안내 */}
                                        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <span className="text-base">2. 벌금 현황 및 안내</span>
                                            </h4>
                                            <div className="space-y-3 pl-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isFineSectionLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                                                        <span className="text-sm font-medium">벌금 현황 잠금</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsFineSectionLocked(!isFineSectionLocked)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFineSectionLocked ? 'bg-amber-500' : 'bg-input'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFineSectionLocked ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. 메이트 콜 현황 */}
                                        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <span className="text-base">3. 메이트 콜 현황</span>
                                            </h4>
                                            <div className="space-y-3 pl-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isMatchingLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                                                        <span className="text-sm font-medium">메이트 매칭 잠금</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsMatchingLocked(!isMatchingLocked)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMatchingLocked ? 'bg-purple-500' : 'bg-input'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMatchingLocked ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">📋</span>
                                                        <span className="text-sm font-medium">현재 날짜를 한주 동일하게 적용</span>
                                                    </div>
                                                    <button
                                                        onClick={copyCurrentDayToWeek}
                                                        disabled={isMatchingLocked}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isMatchingLocked
                                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                            : "bg-green-500 text-white hover:bg-green-600"
                                                            }`}
                                                    >
                                                        적용
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">🎲</span>
                                                        <span className="text-sm font-medium">랜덤 재매칭 실행</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm("현재 날짜의 매칭을 랜덤으로 다시 생성하시겠습니까?\n기존 매칭 정보는 덮어씌워집니다.")) {
                                                                applyRandomMatching();
                                                            }
                                                        }}
                                                        disabled={isMatchingLocked}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isMatchingLocked
                                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                            : "bg-purple-500 text-white hover:bg-purple-600"
                                                            }`}
                                                    >
                                                        실행
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. 체크 항목 */}
                                        <div className="space-y-3 p-3 bg-muted/20 rounded-lg border">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <span className="text-base">4. 체크 항목</span>
                                            </h4>
                                            <div className="space-y-3 pl-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium">체크 항목 수</label>
                                                    <select
                                                        value={checkItemCount}
                                                        onChange={e => setCheckItemCount(Number(e.target.value))}
                                                        className="border rounded p-1 text-sm bg-background"
                                                    >
                                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}개</option>)}
                                                    </select>
                                                </div>

                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {allowPastDateEdit ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                                                        <span className="text-sm font-medium">과거 날짜 수정 허용</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setAllowPastDateEdit(!allowPastDateEdit)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowPastDateEdit ? 'bg-green-500' : 'bg-input'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowPastDateEdit ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>

                                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                                    {checkLabels.slice(0, checkItemCount).map((label, index) => (
                                                        <div key={index} className="p-3 border rounded-lg bg-background/50">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-bold text-muted-foreground">항목 {index + 1}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs">주간 목표</span>
                                                                    <select
                                                                        value={checkWeeklyCount[index]}
                                                                        onChange={e => updateCheckWeeklyCount(index, Number(e.target.value))}
                                                                        className="border rounded p-0.5 bg-background text-xs"
                                                                    >
                                                                        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}회</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={label}
                                                                onChange={e => updateCheckLabel(index, e.target.value)}
                                                                className="w-full p-2 border rounded text-sm bg-background"
                                                                placeholder={`항목 ${index + 1} 이름`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h3 className="font-bold mb-2 text-red-600 flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4" />
                                        데이터 초기화
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        모든 사용자 데이터와 체크 기록을 초기 상태로 되돌립니다.<br />
                                        <span className="font-bold text-red-500">이 작업은 되돌릴 수 없습니다.</span>
                                    </p>

                                    {!showResetConfirm ? (
                                        <button
                                            onClick={() => setShowResetConfirm(true)}
                                            className="w-full py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-bold transition-colors"
                                        >
                                            데이터 전체 초기화
                                        </button>
                                    ) : (
                                        <div className="p-3 border border-red-200 bg-red-50 rounded-lg animate-in fade-in zoom-in duration-200">
                                            <p className="text-center text-red-700 font-bold mb-3 text-sm">정말 초기화 하시겠습니까?</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const success = await resetDashboardData();
                                                        if (success) {
                                                            alert("데이터가 초기화되었습니다. 페이지를 새로고침합니다.");
                                                            window.location.reload();
                                                        } else {
                                                            alert("초기화 실패");
                                                        }
                                                    }}
                                                    className="flex-1 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                                >
                                                    예, 초기화합니다
                                                </button>
                                                <button
                                                    onClick={() => setShowResetConfirm(false)}
                                                    className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Weekly Habit Status Modal */}
            {
                showWeeklyHabitModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
                        <div
                            className="bg-card rounded-2xl shadow-xl w-full p-6 transition-all duration-200"
                            style={{ maxWidth: `${48 * habitModalScale}rem`, width: '100%' }}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    📊 주별 습관 체크 현황
                                    <div className="flex items-center gap-1 ml-4">
                                        <button
                                            onClick={() => setHabitModalScale(prev => Math.max(0.6, prev - 0.1))}
                                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80"
                                            title="축소"
                                        >
                                            -
                                        </button>
                                        <span className="text-xs font-normal text-muted-foreground w-8 text-center">{Math.round(habitModalScale * 100)}%</span>
                                        <button
                                            onClick={() => setHabitModalScale(prev => Math.min(2.0, prev + 0.1))}
                                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80"
                                            title="확대"
                                        >
                                            +
                                        </button>
                                    </div>
                                </h2>
                                <button onClick={() => setShowWeeklyHabitModal(false)} className="text-2xl hover:text-muted-foreground">✕</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-muted/50">
                                            <th className="border p-1 text-left min-w-[70px] text-xs">날짜</th>
                                            <th className="border p-1 text-left min-w-[100px] text-xs">체크 항목</th>
                                            {mates.slice(0, userCount).map((mate) => (
                                                <th key={mate.id} className="border p-1 text-center min-w-[70px] text-xs">
                                                    {mate.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getDatesOfWeek(selectedDate).map((dateStr) => {
                                            const date = new Date(dateStr);
                                            const days = ['일', '월', '화', '수', '목', '금', '토'];
                                            const dayName = days[date.getDay()];
                                            const isToday = dateStr === new Date().toISOString().split('T')[0];

                                            return (
                                                <>
                                                    {checkLabels.slice(0, checkItemCount).map((label, checkIdx) => (
                                                        <tr key={`${dateStr}-${checkIdx}`} className={`hover:bg-muted/30 h-8 ${isToday ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                                                            {checkIdx === 0 && (
                                                                <td className="border p-1 font-medium text-xs" rowSpan={checkItemCount}>
                                                                    <div>{dayName}</div>
                                                                    <div className="text-[10px] text-muted-foreground">
                                                                        {date.getMonth() + 1}/{date.getDate()}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="border p-1 text-xs text-muted-foreground pl-4">
                                                                {label}
                                                            </td>
                                                            {mates.slice(0, userCount).map((mate, mateIdx) => {
                                                                const dayData = habitHistory[dateStr]?.[mateIdx];
                                                                const isChecked = dayData?.customChecks[checkIdx]?.checked || false;

                                                                return (
                                                                    <td key={mate.id} className="border p-1 text-center">
                                                                        {isChecked ? (
                                                                            <span className="text-emerald-500 text-lg">✓</span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground/20">-</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Fine Accumulation Status Modal */}
            {
                showFineAccumulationModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
                        <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    📊 벌금 누적 현황
                                </h2>
                                <button onClick={() => setShowFineAccumulationModal(false)} className="text-2xl hover:text-muted-foreground">✕</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-muted/50">
                                            <th className="border p-2 text-left">이름</th>
                                            <th className="border p-2 text-right">누적 벌금</th>
                                            <th className="border p-2 text-center">건수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mates.slice(0, userCount).map((mate) => {
                                            const userFines = fineRecords.filter(r => r.name === mate.name);
                                            const totalAmount = userFines.reduce((sum, r) => sum + r.amount, 0);
                                            const count = userFines.length;

                                            return (
                                                <tr key={mate.id} className="hover:bg-muted/30">
                                                    <td className="border p-2 font-medium">{mate.name || '-'}</td>
                                                    <td className={`border p-2 text-right font-medium ${totalAmount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                        {totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : '-'}
                                                    </td>
                                                    <td className="border p-2 text-center text-muted-foreground">
                                                        {count > 0 ? `${count}건` : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gradient-to-r from-red-500/10 to-amber-500/10 font-bold">
                                            <td className="border p-2">합계</td>
                                            <td className="border p-2 text-right text-red-500">{totalFine.toLocaleString()}원</td>
                                            <td className="border p-2 text-center">{fineRecords.length}건</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
