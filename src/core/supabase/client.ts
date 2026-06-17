/**
 * FAMILY OS — Client Supabase
 * Utilisé uniquement pour le Partage Familial (listes partagées temps réel).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lwvxdoiduyqytxjeyzvw.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dnhkb2lkdXlxeXR4amV5enZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjQ0NDMsImV4cCI6MjA5NzE0MDQ0M30.E1s1Fihxs1MkJa-JQx-EVeon9NvAyCzwjUmkyZf6Xl0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
