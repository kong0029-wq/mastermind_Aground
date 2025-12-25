import { supabase } from './supabase';

export interface CheckmateData {
    userCount: number;
    checkItemCount: number;
    checkLabels: string[];
    checkWeeklyCount: number[];
    mainWeeklyGoal: number;
    isSettingsLocked: boolean;
    isUserInfoLocked: boolean;
    mates: any[];
    fineRecords: any[];
    dailyHistory?: any; // Marked optional/deprecated
    mateHistory?: Record<string, any[]>;
    habitHistory?: Record<string, any[]>;
    bankInfo: string;
    fineNotice: string;
    adminPassword?: string;
}

// We will use a single row with ID=1 for simplicity in this shared checkmate dashboard
const DATA_ID = 1;

export const DEFAULT_DATA: CheckmateData = {
    userCount: 7,
    checkItemCount: 3,
    checkLabels: ["기상 인증", "독서 인증", "운동 인증", "항목 4", "항목 5", "항목 6", "항목 7", "항목 8", "항목 9", "항목 10"],
    checkWeeklyCount: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    mainWeeklyGoal: 5,
    isSettingsLocked: false,
    isUserInfoLocked: false,
    mates: [
        { id: 1, name: "사용자 1", contact: "010-0000-0000" },
        { id: 2, name: "사용자 2", contact: "010-0000-0000" },
        { id: 3, name: "사용자 3", contact: "010-0000-0000" },
        { id: 4, name: "사용자 4", contact: "010-0000-0001" },
        { id: 5, name: "사용자 5", contact: "010-0000-0002" },
        { id: 6, name: "사용자 6", contact: "010-0000-0003" },
        { id: 7, name: "사용자 7", contact: "010-0000-0004" },
        { id: 8, name: "사용자 8", contact: "010-0000-0005" },
        { id: 9, name: "사용자 9", contact: "010-0000-0006" },
        { id: 10, name: "사용자 10", contact: "010-0000-0007" }
    ],
    fineRecords: [],
    mateHistory: {},
    habitHistory: {},
    bankInfo: "",
    fineNotice: ""
};

export const getDashboardData = async (): Promise<CheckmateData | null> => {
    try {
        const { data, error } = await supabase
            .from('checkmate_data')
            .select('content')
            .eq('id', DATA_ID)
            .single();

        if (error) {
            console.error('Error fetching dashboard data:', error);
            // If row doesn't exist (initial state), try creating it or return null
            return null;
        }

        return data?.content || null;
    } catch (err) {
        console.error('Unexpected error fetching data:', err);
        return null;
    }
};

export const saveDashboardData = async (data: CheckmateData): Promise<boolean> => {
    try {
        // Upsert logic: try to update, if not exists insert (but we need ID to match)
        // Since we want to enforce ID=1, let's check if it exists or just upsert.
        // We will just update based on ID.

        // First, check if row 1 exists. If not, insert allowed only if we manually set ID, 
        // but 'generated always as identity' prevents manual ID insert without override.
        // Alternative: Use a text ID or just rely on the first row found. 
        // For 'generated always', let's just assume identity is 1 or use the first row.
        // To be safe and robust without knowing the exact ID initially:

        // Strategy: Search for any row. If exists, update it. If not, insert.
        const { data: existing } = await supabase.from('checkmate_data').select('id').limit(1).single();

        if (existing) {
            const { error } = await supabase
                .from('checkmate_data')
                .update({ content: data, updated_at: new Date().toISOString() })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('checkmate_data')
                .insert({ content: data });

            if (error) throw error;
        }

        return true;
    } catch (err) {
        console.error('Error saving dashboard data:', err);
        return false;
    }
};

export const resetDashboardData = async (): Promise<boolean> => {
    return await saveDashboardData(DEFAULT_DATA);
};
