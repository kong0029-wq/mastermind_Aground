import { createClient } from '@supabase/supabase-js';

// 환경 변수가 없으면 빌드 에러를 막기 위해 '임시 값(placeholder)'을 넣어줍니다.
// 이 '임시 값'은 배포 과정(Build)만 통과시켜 주고, 
// 실제 사이트가 작동할 때는 아까 설정하신 진짜 환경 변수가 자동으로 들어와서 작동합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseKey);