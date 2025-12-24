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
    dailyHistory: any;
    bankInfo: string;
    fineNotice: string;
}

// We will use a single row with ID=1 for simplicity in this shared checkmate dashboard
const DATA_ID = 1;

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
