import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/types/database'

export const createClient = () => {
  return createClientComponentClient<Database>()
}

export const supabase = createClient()
