const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.error("Error reading .env.local:", e.message);
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    console.log("URL:", supabaseUrl);
    console.log("Key:", supabaseKey ? "Found" : "Missing");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log("Testing connection to Supabase...");
    console.log("URL:", supabaseUrl);

    // 1. Check if table exists and can read
    try {
        const { data, error } = await supabase.from('checkmate_data').select('*').limit(1);

        if (error) {
            console.error("Read Error:", error.message);
            console.error("Details:", error);
            if (error.code === '42P01') {
                console.log("\n[DIAGNOSIS] Table 'checkmate_data' does not exist.");
                console.log("Please run the SQL creation script.");
            } else if (error.code === '42501') {
                console.log("\n[DIAGNOSIS] Permission denied (RLS Violation).");
                console.log("Please run the 'create policy' SQL.");
            }
            return;
        }

        console.log("Read Success. Data found:", data.length > 0 ? "Yes" : "No (Table is empty)");

        // 2. Try to Insert/Update
        const testPayload = { test: "verification", timestamp: new Date().toISOString() };

        if (data.length === 0) {
            console.log("Table is empty. Attempting INSERT...");
            const { error: insertError } = await supabase.from('checkmate_data').insert({ content: testPayload });
            if (insertError) {
                console.error("Insert Error:", insertError.message);
                if (insertError.code === '42501') {
                    console.log("\n[DIAGNOSIS] Insert denied by RLS policy.");
                }
            } else {
                console.log("Insert Success!");
            }
        } else {
            console.log("Row exists. Attempting UPDATE...");
            const { error: updateError } = await supabase.from('checkmate_data').update({ content: testPayload }).eq('id', data[0].id);
            if (updateError) {
                console.error("Update Error:", updateError.message);
                if (updateError.code === '42501') {
                    console.log("\n[DIAGNOSIS] Update denied by RLS policy.");
                }
            } else {
                console.log("Update Success!");
            }
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

testConnection();
