import { createClient } from '@supabase/supabase-js';

// 1. 환경 변수가 있으면 그것을 쓰고
// 2. 없으면(빌드 중일 때) 임시 값("https://placeholder...")을 써서 에러를 막습니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// 이 설정 덕분에 빌드할 때는 가짜 열쇠로 통과하고, 
// 실제 사이트에서는 진짜 열쇠로 작동하게 됩니다.
export const supabase = createClient(supabaseUrl, supabaseKey);