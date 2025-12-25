
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_DATA = {
    userCount: 7, // Default to 7 or as requested? Let's use 7 as consistent with recent edits
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

async function resetDatabase() {
    console.log('Resetting database...');

    // Logic from saveDashboardData: find first row and update
    const { data: existing, error: fetchError } = await supabase.from('checkmate_data').select('id').limit(1).single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Relation not found" or "No rows"? checking 'code' might be tricky, let's just ignore no rows
        console.error('Error checking existing data:', fetchError);
        // Proceed to insert anyway? Or stop?
    }

    if (existing) {
        console.log(`Found existing row with ID ${existing.id}. Updating...`);
        const { error } = await supabase
            .from('checkmate_data')
            .update({ content: DEFAULT_DATA, updated_at: new Date().toISOString() })
            .eq('id', existing.id);

        if (error) {
            console.error('Error updating data:', error);
        } else {
            console.log('Database reset successfully (Updated).');
        }
    } else {
        console.log('No existing data found. Inserting default data...');
        const { error } = await supabase
            .from('checkmate_data')
            .insert({ content: DEFAULT_DATA });

        if (error) {
            console.error('Error inserting data:', error);
        } else {
            console.log('Database reset successfully (Inserted).');
        }
    }
}

resetDatabase();
