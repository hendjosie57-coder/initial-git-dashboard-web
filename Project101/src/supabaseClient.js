import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://fpirolrjhaohzhvvojdh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaXJvbHJqaGFvaHpodnZvamRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NzAyMDMsImV4cCI6MjA5OTE0NjIwM30.gSrMfSfN53VFWDlBdR9puC96D0URJnuUdNbe-ALPxck'

export const supabase = createClient(supabaseUrl, supabaseKey)